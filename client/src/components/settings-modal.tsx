import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Trash2, Plus, Download, Code, AlertTriangle, Upload, Minus } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import VariableImporter from "./variable-importer";
import type { Variable, InsertVariable } from "@shared/schema";

interface SettingsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function SettingsModal({ open, onOpenChange }: SettingsModalProps) {
  const [newVariableName, setNewVariableName] = useState("");
  const [newVariableValue, setNewVariableValue] = useState("");
  const [showImporter, setShowImporter] = useState(false);
  const [fontSize, setFontSize] = useState(() => {
    const saved = localStorage.getItem('notes-font-size');
    return saved ? parseInt(saved) : 14;
  });
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Apply font size on component mount
  useEffect(() => {
    document.documentElement.style.setProperty('--notes-font-size', `${fontSize}px`);
  }, [fontSize]);

  const { data: variables = [] } = useQuery<Variable[]>({
    queryKey: ["/api/variables"],
  });

  const createVariableMutation = useMutation({
    mutationFn: async (variable: InsertVariable) => {
      const response = await apiRequest("POST", "/api/variables", variable);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/variables"] });
      setNewVariableName("");
      setNewVariableValue("");
      toast({
        title: "Variable created",
        description: "Your custom variable has been added.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create variable. Please try again.",
        variant: "destructive",
      });
    },
  });

  const updateVariableMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<InsertVariable> }) => {
      const response = await apiRequest("PUT", `/api/variables/${id}`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/variables"] });
      toast({
        title: "Variable updated",
        description: "Your changes have been saved.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update variable. Please try again.",
        variant: "destructive",
      });
    },
  });

  const deleteVariableMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/variables/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/variables"] });
      toast({
        title: "Variable deleted",
        description: "The variable has been removed.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete variable. Please try again.",
        variant: "destructive",
      });
    },
  });

  const clearAllNotesMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("DELETE", "/api/notes");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notes"] });
      toast({
        title: "All notes cleared",
        description: "Your notes have been deleted successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to clear notes. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleAddVariable = () => {
    if (!newVariableName.trim() || !newVariableValue.trim()) {
      toast({
        title: "Invalid input",
        description: "Both variable name and value are required.",
        variant: "destructive",
      });
      return;
    }

    createVariableMutation.mutate({
      name: newVariableName.trim(),
      values: [newVariableValue.trim()],
    });
  };

  const handleUpdateVariable = (id: string, field: 'name' | 'values', value: string | string[]) => {
    updateVariableMutation.mutate({
      id,
      data: { [field]: value },
    });
  };

  const handleAddValueToVariable = (variableId: string, newValue: string) => {
    const variable = variables.find(v => v.id === variableId);
    if (!variable) return;
    
    const updatedValues = [...(variable.values || []), newValue];
    updateVariableMutation.mutate({
      id: variableId,
      data: { values: updatedValues },
    });
  };

  const handleFontSizeChange = (newSize: number) => {
    const clampedSize = Math.max(12, Math.min(24, newSize));
    setFontSize(clampedSize);
    localStorage.setItem('notes-font-size', clampedSize.toString());
    
    // Apply to CSS custom property for immediate effect
    document.documentElement.style.setProperty('--notes-font-size', `${clampedSize}px`);
  };

  const handleRemoveValueFromVariable = (variableId: string, valueIndex: number) => {
    const variable = variables.find(v => v.id === variableId);
    if (!variable || !variable.values) return;
    
    const updatedValues = variable.values.filter((_, index) => index !== valueIndex);
    updateVariableMutation.mutate({
      id: variableId,
      data: { values: updatedValues },
    });
  };

  const handleExport = async (format: 'text' | 'json') => {
    try {
      const response = await fetch(`/api/export/${format}`, {
        credentials: 'include',
      });
      
      if (!response.ok) throw new Error('Export failed');
      
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `notes.${format === 'text' ? 'txt' : 'json'}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      toast({
        title: "Export successful",
        description: `Your notes have been exported as ${format.toUpperCase()}.`,
      });
    } catch (error) {
      toast({
        title: "Export failed",
        description: "Failed to export notes. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleClearAllNotes = () => {
    if (window.confirm("Are you sure you want to delete all notes? This action cannot be undone.")) {
      clearAllNotesMutation.mutate();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
        </DialogHeader>

        <div className="overflow-y-auto max-h-[calc(90vh-120px)] space-y-6">
          {/* Variables Section */}
          <div>
            <h3 className="text-lg font-medium mb-4">Custom Variables</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Create custom variables that you can quickly insert into your notes using the{" "}
              <code className="bg-muted px-1 rounded">/variable</code> syntax.
            </p>
            
            {/* Variable List */}
            <div className="space-y-4">
              {variables.map((variable) => (
                <div
                  key={variable.id}
                  className="p-4 bg-accent/30 dark:bg-accent/20 rounded-lg"
                  data-testid={`variable-${variable.name}`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex-1">
                      <Label className="text-xs font-medium text-muted-foreground">
                        Variable Name
                      </Label>
                      <Input
                        value={variable.name}
                        onChange={(e) => handleUpdateVariable(variable.id, 'name', e.target.value)}
                        className="mt-1"
                        data-testid={`input-variable-name-${variable.name}`}
                      />
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => deleteVariableMutation.mutate(variable.id)}
                      className="text-muted-foreground hover:text-destructive ml-3"
                      data-testid={`button-delete-variable-${variable.name}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                  
                  <div>
                    <Label className="text-xs font-medium text-muted-foreground">
                      Values ({variable.values?.length || 0})
                    </Label>
                    <div className="mt-2 space-y-2">
                      {variable.values?.map((value, index) => (
                        <div key={index} className="flex items-center space-x-2">
                          <Input
                            value={value}
                            onChange={(e) => {
                              const newValues = [...(variable.values || [])];
                              newValues[index] = e.target.value;
                              handleUpdateVariable(variable.id, 'values', newValues);
                            }}
                            className="flex-1"
                            data-testid={`input-variable-value-${variable.name}-${index}`}
                          />
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemoveValueFromVariable(variable.id, index)}
                            className="text-muted-foreground hover:text-destructive"
                            data-testid={`button-remove-value-${variable.name}-${index}`}
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      ))}
                      
                      <div className="flex items-center space-x-2">
                        <Input
                          placeholder="Add new value..."
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              const input = e.target as HTMLInputElement;
                              if (input.value.trim()) {
                                handleAddValueToVariable(variable.id, input.value.trim());
                                input.value = '';
                              }
                            }
                          }}
                          className="flex-1"
                          data-testid={`input-add-value-${variable.name}`}
                        />
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            const input = (e.target as HTMLElement).closest('.flex')?.querySelector('input') as HTMLInputElement;
                            if (input?.value.trim()) {
                              handleAddValueToVariable(variable.id, input.value.trim());
                              input.value = '';
                            }
                          }}
                          data-testid={`button-add-value-${variable.name}`}
                        >
                          <Plus className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Import/Add Actions */}
            <div className="mt-4 flex space-x-2">
              <Button
                onClick={() => setShowImporter(true)}
                variant="outline"
                className="flex-1"
                data-testid="button-import-variables"
              >
                <Upload className="w-4 h-4 mr-2" />
                Import Variables
              </Button>
            </div>

            {/* Add Variable Form */}
            <div className="mt-4 p-4 border-2 border-dashed border-border dark:border-border rounded-lg">
              <div className="grid grid-cols-2 gap-3 mb-3">
                <div>
                  <Label className="text-xs font-medium text-muted-foreground">
                    Variable Name
                  </Label>
                  <Input
                    placeholder="e.g., user"
                    value={newVariableName}
                    onChange={(e) => setNewVariableName(e.target.value)}
                    className="mt-1"
                    data-testid="input-new-variable-name"
                  />
                </div>
                <div>
                  <Label className="text-xs font-medium text-muted-foreground">
                    Value
                  </Label>
                  <Input
                    placeholder="e.g., John Doe"
                    value={newVariableValue}
                    onChange={(e) => setNewVariableValue(e.target.value)}
                    className="mt-1"
                    data-testid="input-new-variable-value"
                  />
                </div>
              </div>
              <Button
                onClick={handleAddVariable}
                disabled={createVariableMutation.isPending}
                className="w-full"
                data-testid="button-add-variable"
              >
                <Plus className="w-4 h-4 mr-2" />
                {createVariableMutation.isPending ? 'Adding...' : 'Add Variable'}
              </Button>
            </div>
          </div>

          {/* Font Size Section */}
          <div className="pt-6 border-t border-border">
            <h3 className="text-lg font-medium mb-4">Font Size</h3>
            <div className="space-y-3">
              <Label className="text-sm font-medium">Note Text Size</Label>
              <div className="flex items-center space-x-3">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleFontSizeChange(fontSize - 1)}
                  disabled={fontSize <= 12}
                  data-testid="button-decrease-font"
                >
                  <Minus className="w-4 h-4" />
                </Button>
                <div className="flex-1 flex items-center justify-center">
                  <span className="text-sm font-mono bg-accent px-3 py-1 rounded">
                    {fontSize}px
                  </span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleFontSizeChange(fontSize + 1)}
                  disabled={fontSize >= 24}
                  data-testid="button-increase-font"
                >
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground text-center">
                Adjust reading comfort (12px - 24px)
              </p>
            </div>
          </div>

          {/* Export Section */}
          <div className="pt-6 border-t border-border">
            <h3 className="text-lg font-medium mb-4">Export & Backup</h3>
            <div className="space-y-3">
              <Button
                onClick={() => handleExport('text')}
                className="w-full"
                data-testid="button-export-text"
              >
                <Download className="w-4 h-4 mr-2" />
                Export All Notes as Text
              </Button>
              <Button
                onClick={() => handleExport('json')}
                variant="secondary"
                className="w-full"
                data-testid="button-export-json"
              >
                <Code className="w-4 h-4 mr-2" />
                Export as JSON
              </Button>
            </div>
          </div>

          {/* Clear Data Section */}
          <div className="pt-6 border-t border-border">
            <h3 className="text-lg font-medium mb-4">Data Management</h3>
            <Button
              onClick={handleClearAllNotes}
              variant="destructive"
              disabled={clearAllNotesMutation.isPending}
              className="w-full"
              data-testid="button-clear-all-notes"
            >
              <AlertTriangle className="w-4 h-4 mr-2" />
              {clearAllNotesMutation.isPending ? 'Clearing...' : 'Clear All Notes'}
            </Button>
            <p className="text-xs text-muted-foreground mt-2 text-center">
              This action cannot be undone. Please export your notes first.
            </p>
          </div>
        </div>
      </DialogContent>
      
      <VariableImporter 
        open={showImporter}
        onOpenChange={setShowImporter}
      />
    </Dialog>
  );
}
