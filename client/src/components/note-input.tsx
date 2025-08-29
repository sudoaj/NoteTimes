import { useState, useRef, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tag, Image, FileText, Folder } from "lucide-react";
import { format } from "date-fns";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import FileUploader from "./file-uploader";
import type { Variable, InsertNote } from "@shared/schema";

export default function NoteInput() {
  const [content, setContent] = useState("");
  const [currentTime, setCurrentTime] = useState("");
  const [selectedFolder, setSelectedFolder] = useState("General");
  const [showAutocomplete, setShowAutocomplete] = useState(false);
  const [autocompletePosition, setAutocompletePosition] = useState(0);
  const [filteredOptions, setFilteredOptions] = useState<Array<{
    type: 'variable' | 'value';
    variable: Variable;
    value?: string;
    matchedText: string;
  }>>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [attachedFiles, setAttachedFiles] = useState<File[]>([]);
  
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: variables = [] } = useQuery<Variable[]>({
    queryKey: ["/api/variables"],
  });


  const { data: folders = [] } = useQuery<string[]>({
    queryKey: ["/api/folders"],
  });

  const createNoteMutation = useMutation({
    mutationFn: async (note: InsertNote) => {
      const response = await apiRequest("POST", "/api/notes", note);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notes"] });
      setContent("");
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create note. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Update current time every 100ms for better sync
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(format(now, 'hh:mm a'));
    };
    
    updateTime();
    const interval = setInterval(updateTime, 100);
    
    return () => clearInterval(interval);
  }, []);

  // Handle variable substitution and autocomplete
  const processContent = (rawContent: string): { content: string; originalContent: string } => {
    let processedContent = rawContent;
    
    // Handle variable values with invisible markers (these are already resolved values)
    processedContent = processedContent.replace(/\u200B([^\u200B]+)\u200B/g, '$1');
    
    // Handle regular variable references
    variables.forEach(variable => {
      const regex = new RegExp(`/${variable.name}\\b`, 'g');
      const value = variable.values && variable.values.length > 0 ? variable.values[0] : variable.name;
      processedContent = processedContent.replace(regex, value);
    });
    
    return {
      content: processedContent,
      originalContent: rawContent
    };
  };

  // Parse content into segments (text and variables)
  const parseContentToSegments = (content: string) => {
    const segments: Array<{ type: 'text' | 'variable'; content: string; variable?: Variable }> = [];
    let lastIndex = 0;
    
    // Find all variable mentions
    const matches: Array<{ start: number; end: number; variable: Variable }> = [];
    
    variables.forEach(variable => {
      const regex = new RegExp(`\\/${variable.name}\\b`, 'g');
      let match;
      while ((match = regex.exec(content)) !== null) {
        matches.push({
          start: match.index,
          end: match.index + match[0].length,
          variable
        });
      }
    });

    // Sort matches by position
    matches.sort((a, b) => a.start - b.start);

    // Build segments
    matches.forEach(match => {
      // Add text before the match
      if (match.start > lastIndex) {
        segments.push({
          type: 'text',
          content: content.slice(lastIndex, match.start)
        });
      }
      
      // Add variable segment
      segments.push({
        type: 'variable',
        content: content.slice(match.start, match.end),
        variable: match.variable
      });
      
      lastIndex = match.end;
    });

    // Add remaining text
    if (lastIndex < content.length) {
      segments.push({
        type: 'text',
        content: content.slice(lastIndex)
      });
    }

    return segments.length > 0 ? segments : [{ type: 'text' as const, content }];
  };

  // Check if content has variables
  const hasVariableContent = (content: string) => {
    return /\/\w+|\u200B[^\u200B]+\u200B/.test(content);
  };

  // Render styled content for overlay
  const renderStyledContent = (content: string) => {
    if (!hasVariableContent(content)) return content;

    const parts: React.ReactNode[] = [];
    let lastIndex = 0;
    
    // Find all matches (both variable references and resolved values)
    const matches: Array<{ 
      start: number; 
      end: number; 
      type: 'variable' | 'resolved_value'; 
      text: string; 
    }> = [];
    
    // Find variable values with invisible markers
    const resolvedValueRegex = /\u200B([^\u200B]+)\u200B/g;
    let resolvedMatch;
    while ((resolvedMatch = resolvedValueRegex.exec(content)) !== null) {
      matches.push({
        start: resolvedMatch.index,
        end: resolvedMatch.index + resolvedMatch[0].length,
        type: 'resolved_value',
        text: resolvedMatch[1]
      });
    }
    
    // Find variable references
    const variableRegex = /\/\w+/g;
    let variableMatch;
    while ((variableMatch = variableRegex.exec(content)) !== null) {
      matches.push({
        start: variableMatch.index,
        end: variableMatch.index + variableMatch[0].length,
        type: 'variable',
        text: variableMatch[0]
      });
    }

    // Sort matches by position
    matches.sort((a, b) => a.start - b.start);

    // Build the content with styling
    matches.forEach((match, index) => {
      // Add normal text before the match
      if (match.start > lastIndex) {
        parts.push(
          <span key={`text-${index}`} className="text-foreground">
            {content.slice(lastIndex, match.start)}
          </span>
        );
      }
      
      // Add styled variable/value
      parts.push(
        <span 
          key={`styled-${index}`}
          className="text-foreground font-bold italic"
        >
          {match.text}
        </span>
      );
      
      lastIndex = match.end;
    });

    // Add remaining text
    if (lastIndex < content.length) {
      parts.push(
        <span key="text-end" className="text-foreground">
          {content.slice(lastIndex)}
        </span>
      );
    }

    return parts.length > 0 ? <>{parts}</> : content;
  };

  const handleInputChange = (value: string) => {
    setContent(value);
    
    // Smart variable search across all variables and values
    const cursorPosition = textareaRef.current?.selectionStart || 0;
    const textBeforeCursor = value.substring(0, cursorPosition);
    const lastSlashIndex = textBeforeCursor.lastIndexOf('/');
    
    if (lastSlashIndex !== -1) {
      const searchTerm = textBeforeCursor.substring(lastSlashIndex + 1).toLowerCase();
      
      // Only show autocomplete if the search term doesn't contain spaces
      if (!searchTerm.includes(' ')) {
        const options: typeof filteredOptions = [];
        
        variables.forEach(variable => {
          // Check if variable name matches
          if (variable.name.toLowerCase().includes(searchTerm)) {
            options.push({
              type: 'variable',
              variable,
              matchedText: variable.name
            });
          }
          
          // Check if any variable values match
          variable.values?.forEach(value => {
            if (value.toLowerCase().includes(searchTerm)) {
              options.push({
                type: 'value',
                variable,
                value,
                matchedText: value
              });
            }
          });
        });
        
        if (options.length > 0) {
          // Sort by relevance: exact matches first, then starts with, then contains
          options.sort((a, b) => {
            const aText = a.matchedText.toLowerCase();
            const bText = b.matchedText.toLowerCase();
            
            // Exact match
            if (aText === searchTerm && bText !== searchTerm) return -1;
            if (bText === searchTerm && aText !== searchTerm) return 1;
            
            // Starts with
            if (aText.startsWith(searchTerm) && !bText.startsWith(searchTerm)) return -1;
            if (bText.startsWith(searchTerm) && !aText.startsWith(searchTerm)) return 1;
            
            // Length (shorter first for better matches)
            return aText.length - bText.length;
          });
          
          setFilteredOptions(options);
          setShowAutocomplete(true);
          setAutocompletePosition(lastSlashIndex);
          setSelectedIndex(0);
        } else {
          setShowAutocomplete(false);
        }
      } else {
        setShowAutocomplete(false);
      }
    } else {
      setShowAutocomplete(false);
    }
  };

  const insertOption = (option: typeof filteredOptions[0]) => {
    const cursorPosition = textareaRef.current?.selectionStart || 0;
    const textBeforeCursor = content.substring(0, autocompletePosition);
    const textAfterCursor = content.substring(cursorPosition);
    
    // Insert based on option type
    let valueToInsert: string;
    if (option.type === 'value') {
      // Use invisible markers to track variable values - using Zero Width Space (U+200B)
      valueToInsert = `\u200B${option.value}\u200B`;
    } else {
      // Insert variable name
      valueToInsert = `/${option.variable.name}`;
    }
    
    const newContent = textBeforeCursor + valueToInsert + textAfterCursor;
    setContent(newContent);
    setShowAutocomplete(false);
    
    // Focus back to textarea
    setTimeout(() => {
      if (textareaRef.current) {
        const newCursorPosition = textBeforeCursor.length + valueToInsert.length;
        textareaRef.current.focus();
        textareaRef.current.setSelectionRange(newCursorPosition, newCursorPosition);
      }
    }, 0);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (showAutocomplete) {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex((prev) => 
            prev < filteredOptions.length - 1 ? prev + 1 : prev
          );
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex((prev) => prev > 0 ? prev - 1 : prev);
          break;
        case 'Tab':
        case 'Enter':
          e.preventDefault();
          if (filteredOptions[selectedIndex]) {
            insertOption(filteredOptions[selectedIndex]);
          }
          break;
        case 'Escape':
          setShowAutocomplete(false);
          break;
      }
    } else if (e.key === 'Enter') {
      if (e.shiftKey) {
        // Shift+Enter: Add new line (default behavior)
        return;
      } else {
        // Enter: Submit note
        e.preventDefault();
        handleSubmit();
      }
    }
  };

  const handleFileSelect = (file: File) => {
    setAttachedFiles(prev => [...prev, file]);
    
    // Add file reference to content
    const fileRef = file.type.startsWith('image/') 
      ? `📷 ${file.name}` 
      : `📎 ${file.name}`;
    
    const newContent = content + (content ? '\n' : '') + fileRef;
    setContent(newContent);
    
    toast({
      title: "File attached",
      description: `${file.name} has been attached to your note.`,
    });
  };

  const removeAttachment = (index: number) => {
    const file = attachedFiles[index];
    setAttachedFiles(prev => prev.filter((_, i) => i !== index));
    
    // Remove file reference from content
    const fileRef = file.type.startsWith('image/') 
      ? `📷 ${file.name}` 
      : `📎 ${file.name}`;
    
    setContent(prev => prev.replace(new RegExp(`\\n?${fileRef.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'g'), ''));
    
    toast({
      title: "File removed",
      description: `${file.name} has been removed from your note.`,
    });
  };

  const handleSubmit = () => {
    if (!content.trim() && attachedFiles.length === 0) return;
    
    let finalContent = content;
    
    // Add file attachments to content if any
    if (attachedFiles.length > 0) {
      const fileList = attachedFiles.map(file => {
        return file.type.startsWith('image/') 
          ? `📷 ${file.name}` 
          : `📎 ${file.name}`;
      }).join('\n');
      
      if (!content.includes(fileList)) {
        finalContent = content + (content ? '\n' : '') + fileList;
      }
    }
    
    const { content: processedContent, originalContent } = processContent(finalContent);
    
    // Extract tags (simple implementation - words that start with #)
    const tags = Array.from(finalContent.matchAll(/#(\w+)/g), m => m[1]);
    
    createNoteMutation.mutate({
      content: processedContent,
      originalContent,
      tags,
      folder: selectedFolder,
    });
    
    // Clear attachments
    setAttachedFiles([]);
  };

  const autoResizeTextarea = () => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = Math.max(24, textareaRef.current.scrollHeight) + 'px';
    }
  };

  useEffect(() => {
    autoResizeTextarea();
  }, [content]);

  return (
    <div className="border-t border-border bg-card rounded-t-lg">
      <div className="p-4 md:p-6">
        <div className="relative">
          <div className="flex items-start space-x-3">
            <span className="timestamp text-muted-foreground mt-3 min-w-[60px] font-mono text-xs">
              {currentTime}
            </span>
            <div className="flex-1 relative">
              {/* Styled overlay for variable highlighting */}
              <div 
                className="absolute inset-0 w-full resize-none border-0 bg-transparent text-transparent font-serif text-base leading-relaxed min-h-[80px] p-2 rounded-md pointer-events-none z-10 whitespace-pre-wrap overflow-hidden"
                style={{ 
                  wordWrap: 'break-word',
                  overflowWrap: 'break-word'
                }}
              >
                {renderStyledContent(content)}
              </div>
              
              <Textarea
                ref={textareaRef}
                placeholder="Start writing..."
                value={content}
                onChange={(e) => handleInputChange(e.target.value)}
                onKeyDown={handleKeyDown}
                className={`w-full resize-none border-0 bg-transparent placeholder-muted-foreground font-serif text-base leading-relaxed min-h-[24px] p-2 rounded-md hover:bg-accent/50 focus:bg-accent/30 transition-colors focus-visible:ring-0 relative z-20 ${
                  hasVariableContent(content) ? 'text-transparent' : 'text-foreground'
                }`}
                style={{ 
                  caretColor: 'var(--foreground)' // Keep cursor visible
                }}
                data-testid="textarea-note-input"
              />
              
              {/* Smart Autocomplete Dropdown */}
              {showAutocomplete && (
                <div className="absolute bottom-full left-2 mb-2 bg-popover border border-border rounded-lg shadow-lg py-2 w-80 z-50 max-h-64 overflow-y-auto">
                  <div className="px-3 py-1 text-xs font-medium text-muted-foreground uppercase tracking-wide border-b border-border/30 mb-2">
                    Smart Search Results
                  </div>
                  {filteredOptions.map((option, index) => (
                    <div 
                      key={`${option.variable.id}-${option.type}-${option.value || 'var'}`}
                      className={`px-3 py-2 cursor-pointer transition-colors ${
                        index === selectedIndex ? 'bg-accent/70' : 'hover:bg-accent/30'
                      }`}
                      onClick={() => insertOption(option)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          {option.type === 'variable' ? (
                            <span className="text-foreground font-medium">/{option.variable.name}</span>
                          ) : (
                            <span className="text-foreground font-medium">{option.value}</span>
                          )}
                        </div>
                        <div className="flex items-center space-x-1">
                          {index === selectedIndex && (
                            <kbd className="text-xs text-muted-foreground bg-muted px-1 rounded">Tab</kbd>
                          )}
                        </div>
                      </div>
                      
                      {option.type === 'value' && (
                        <div className="text-xs text-muted-foreground mt-1 ml-6">
                          from variable "/{option.variable.name}"
                        </div>
                      )}
                      
                      {option.type === 'variable' && option.variable.values?.length && (
                        <div className="text-xs text-muted-foreground mt-1 ml-6">
                          {option.variable.values.length} values available
                        </div>
                      )}
                    </div>
                  ))}
                  
                  {filteredOptions.length === 0 && (
                    <div className="px-3 py-2 text-xs text-muted-foreground">
                      No matches found. Continue typing to search...
                    </div>
                  )}
                  
                  <div className="px-3 py-1 text-xs text-muted-foreground border-t border-border/30 mt-2">
                    Use ↑↓ arrows to navigate, Tab/Enter to select, Esc to close
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Attached Files */}
          {attachedFiles.length > 0 && (
            <div className="mt-3 px-3">
              <div className="flex flex-wrap gap-2">
                {attachedFiles.map((file, index) => (
                  <div
                    key={index}
                    className="flex items-center space-x-2 bg-accent/50 dark:bg-accent/30 rounded-md px-2 py-1 text-xs"
                  >
                    {file.type.startsWith('image/') ? (
                      <Image className="w-3 h-3" />
                    ) : (
                      <FileText className="w-3 h-3" />
                    )}
                    <span className="truncate max-w-32">{file.name}</span>
                    <button
                      onClick={() => removeAttachment(index)}
                      className="text-muted-foreground hover:text-foreground ml-1"
                      data-testid={`button-remove-file-${index}`}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Compact Actions Row */}
          <div className="flex items-center justify-between mt-3 px-3 gap-2">
            {/* Left side: Folder + File uploads + Add tag */}
            <div className="flex items-center space-x-2">
              <Folder className="w-4 h-4 text-muted-foreground" />
              <Select value={selectedFolder} onValueChange={setSelectedFolder}>
                <SelectTrigger className="w-32 h-7 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {["General", ...folders.filter(f => f !== "General")].map(folder => (
                    <SelectItem key={folder} value={folder}>{folder}</SelectItem>
                  ))}
                  <div className="border-t border-border mt-1 pt-1">
                    <button
                      className="w-full px-2 py-1 text-left text-xs text-muted-foreground hover:bg-accent rounded"
                      onClick={async () => {
                        const folderName = prompt("Enter new folder name:");
                        if (folderName && folderName.trim()) {
                          try {
                            await apiRequest("POST", "/api/folders", { name: folderName.trim() });
                            setSelectedFolder(folderName.trim());
                            // Invalidate folders query to refresh the list
                            queryClient.invalidateQueries({ queryKey: ["/api/folders"] });
                          } catch (error) {
                            console.error("Failed to create folder:", error);
                          }
                        }
                      }}
                    >
                      + Create new folder
                    </button>
                  </div>
                </SelectContent>
              </Select>
              
              <FileUploader onFileSelect={handleFileSelect} accept="image/*" />
              <FileUploader 
                onFileSelect={handleFileSelect} 
                accept=".pdf,.txt,.doc,.docx,.md" 
                className="ml-1"
              />
              <Button
                variant="ghost"
                size="sm"
                className="text-muted-foreground hover:text-foreground h-7 px-2 text-xs"
                onClick={() => {
                  const tag = prompt("Enter a tag name:");
                  if (tag && tag.trim()) {
                    const tagText = `#${tag.trim()} `;
                    setContent(prev => prev + tagText);
                    if (textareaRef.current) {
                      textareaRef.current.focus();
                      textareaRef.current.setSelectionRange(content.length + tagText.length, content.length + tagText.length);
                    }
                  }
                }}
                data-testid="button-add-tag"
              >
                <Tag className="w-3 h-3 mr-1" />
                Add tag
              </Button>
            </div>
            
            {/* Right side: Variables tip + Save button */}
            <div className="flex items-center space-x-2">
              <div className="text-xs text-muted-foreground">
                Type <code className="bg-muted px-1 rounded text-xs">/</code> for variables
              </div>
              <Button
                onClick={handleSubmit}
                disabled={(!content.trim() && attachedFiles.length === 0) || createNoteMutation.isPending}
                size="sm"
                className="h-7 px-3 text-xs"
                data-testid="button-save-note"
              >
                {createNoteMutation.isPending ? 'Saving...' : 'Save'}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
