import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Upload, FileText } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import type { InsertVariable } from '@shared/schema';

interface VariableImporterProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function VariableImporter({ open, onOpenChange }: VariableImporterProps) {
  const [importMethod, setImportMethod] = useState<'text' | 'file'>('text');
  const [textInput, setTextInput] = useState('');
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const importVariablesMutation = useMutation({
    mutationFn: async (variables: InsertVariable[]) => {
      // Import variables one by one
      const results = [];
      for (const variable of variables) {
        try {
          const response = await apiRequest("POST", "/api/variables", variable);
          results.push(await response.json());
        } catch (error) {
          console.warn(`Failed to import variable ${variable.name}:`, error);
        }
      }
      return results;
    },
    onSuccess: (results) => {
      queryClient.invalidateQueries({ queryKey: ["/api/variables"] });
      toast({
        title: "Variables imported",
        description: `Successfully imported ${results.length} variables.`,
      });
      setTextInput('');
      onOpenChange(false);
    },
    onError: () => {
      toast({
        title: "Import failed",
        description: "Failed to import variables. Please check the format and try again.",
        variant: "destructive",
      });
    },
  });

  const parseVariables = (text: string): InsertVariable[] => {
    const variables: InsertVariable[] = [];
    const lines = text.split('\n').filter(line => line.trim());
    
    for (const line of lines) {
      // Support multiple formats:
      // name=value
      // name:value  
      // name,value
      // /name=value
      let match = line.match(/^\/?([\w\-_]+)[:=,]\s*(.+)$/);
      if (match) {
        variables.push({
          name: match[1].trim(),
          value: match[2].trim(),
        });
      }
    }
    
    return variables;
  };

  const handleFileImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      setTextInput(content);
      setImportMethod('text');
    };
    reader.readAsText(file);
  };

  const handleImport = () => {
    const variables = parseVariables(textInput);
    
    if (variables.length === 0) {
      toast({
        title: "No variables found",
        description: "Please check the format. Use name=value, name:value, or name,value format.",
        variant: "destructive",
      });
      return;
    }

    importVariablesMutation.mutate(variables);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Import Variables</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Import Method Selection */}
          <div className="flex space-x-2">
            <Button
              variant={importMethod === 'text' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setImportMethod('text')}
              data-testid="button-import-text"
            >
              <FileText className="w-4 h-4 mr-2" />
              Text
            </Button>
            <Button
              variant={importMethod === 'file' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setImportMethod('file')}
              data-testid="button-import-file"
            >
              <Upload className="w-4 h-4 mr-2" />
              File
            </Button>
          </div>

          {importMethod === 'file' && (
            <div>
              <Label>Choose file</Label>
              <Input
                type="file"
                accept=".txt,.csv"
                onChange={handleFileImport}
                className="mt-1"
                data-testid="input-import-file"
              />
            </div>
          )}

          {/* Text Input */}
          <div>
            <Label>Variables (one per line)</Label>
            <Textarea
              placeholder={`user=John Doe
company:Acme Inc
project,Alpha Project
email=user@example.com`}
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              className="mt-1 font-mono text-sm min-h-[120px]"
              data-testid="textarea-import-variables"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Supported formats: name=value, name:value, name,value
            </p>
          </div>

          {/* Import Button */}
          <Button
            onClick={handleImport}
            disabled={!textInput.trim() || importVariablesMutation.isPending}
            className="w-full"
            data-testid="button-import-variables"
          >
            {importVariablesMutation.isPending ? 'Importing...' : 'Import Variables'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}