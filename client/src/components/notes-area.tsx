import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format, isSameDay, parseISO } from "date-fns";
import { ArrowUpDown, Clock, Hash, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import NoteInput from "./note-input";
import NoteDownload from "./note-download";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Note, Variable } from "@shared/schema";

interface NotesAreaProps {
  selectedTag: string | null;
  selectedFolder?: string | null;
}

type SortOption = 'newest' | 'oldest' | 'mentions';

export default function NotesArea({ selectedTag, selectedFolder }: NotesAreaProps) {
  const [sortBy, setSortBy] = useState<SortOption>('newest');
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  const { data: notes = [], isLoading } = useQuery<Note[]>({
    queryKey: ["/api/notes"],
  });
  
  const { data: variables = [] } = useQuery<Variable[]>({
    queryKey: ["/api/variables"],
  });

  const deleteNoteMutation = useMutation({
    mutationFn: async (noteId: string) => {
      const response = await apiRequest("DELETE", `/api/notes/${noteId}`);
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Delete failed: ${response.status} ${errorText}`);
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notes"] });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to delete note: ${error instanceof Error ? error.message : 'Unknown error'}`,
        variant: "destructive",
      });
    },
  });

  // Function to count variable mentions in a note
  const countVariableMentions = (note: Note) => {
    let count = 0;
    variables.forEach(variable => {
      const regex = new RegExp(`\\/${variable.name}\\b`, 'g');
      const matches = note.content.match(regex);
      if (matches) count += matches.length;
    });
    return count;
  };

  // Filter notes by selected tag and folder
  let filteredNotes = notes;
  
  if (selectedTag) {
    filteredNotes = filteredNotes.filter(note => note.tags?.includes(selectedTag));
  }
  
  if (selectedFolder) {
    filteredNotes = filteredNotes.filter(note => note.folder === selectedFolder);
  }

  // Sort notes based on selected option
  const sortedNotes = [...filteredNotes].sort((a, b) => {
    switch (sortBy) {
      case 'newest':
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      case 'oldest':
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      case 'mentions':
        return countVariableMentions(b) - countVariableMentions(a);
      default:
        return 0;
    }
  });

  // Group notes by date
  const notesByDate = sortedNotes.reduce((acc, note) => {
    const date = format(parseISO(note.createdAt.toString()), 'yyyy-MM-dd');
    if (!acc[date]) acc[date] = [];
    acc[date].push(note);
    return acc;
  }, {} as Record<string, Note[]>);

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-muted-foreground">Loading notes...</div>
      </div>
    );
  }

  const tagColors = [
    'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
    'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300', 
    'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
    'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
    'bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-300',
    'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300',
  ];

  // Function to render note content with highlighted variables
  const renderContentWithHighlights = (content: string) => {
    const parts: React.ReactNode[] = [];
    let lastIndex = 0;
    
    // Find all matches (both variable references and resolved values)
    const matches: Array<{ 
      start: number; 
      end: number; 
      type: 'variable' | 'resolved_value'; 
      variable?: string; 
      value?: string; 
    }> = [];
    
    // Find variable values with invisible markers (resolved values)
    const resolvedValueRegex = /\u200B([^\u200B]+)\u200B/g;
    let resolvedMatch;
    while ((resolvedMatch = resolvedValueRegex.exec(content)) !== null) {
      matches.push({
        start: resolvedMatch.index,
        end: resolvedMatch.index + resolvedMatch[0].length,
        type: 'resolved_value',
        value: resolvedMatch[1]
      });
    }
    
    // Find variable references
    if (variables.length > 0) {
      variables.forEach(variable => {
        const regex = new RegExp(`\\/${variable.name}\\b`, 'g');
        let match;
        while ((match = regex.exec(content)) !== null) {
          matches.push({
            start: match.index,
            end: match.index + match[0].length,
            type: 'variable',
            variable: variable.name
          });
        }
      });
    }

    // Sort matches by position
    matches.sort((a, b) => a.start - b.start);

    // Build the content with highlights
    matches.forEach((match, index) => {
      // Add text before the match
      if (match.start > lastIndex) {
        parts.push(content.slice(lastIndex, match.start));
      }
      
      if (match.type === 'variable') {
        // Add highlighted variable reference
        parts.push(
          <span 
            key={`var-${index}`}
            className="inline-flex items-center px-2 py-1 mx-0.5 rounded-md text-sm font-semibold bg-gradient-to-r from-purple-100 to-blue-100 text-purple-800 dark:from-purple-900/40 dark:to-blue-900/40 dark:text-purple-300 border border-purple-200 dark:border-purple-700 shadow-sm"
            title={`Variable: ${match.variable}`}
          >
            /{match.variable}
          </span>
        );
      } else if (match.type === 'resolved_value') {
        // Add highlighted resolved value
        parts.push(
          <span 
            key={`val-${index}`}
            className="inline-flex items-center px-2 py-1 mx-0.5 rounded-md text-sm font-semibold bg-gradient-to-r from-emerald-100 to-teal-100 text-emerald-800 dark:from-emerald-900/40 dark:to-teal-900/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-700 shadow-sm"
            title={`Resolved variable value: ${match.value}`}
          >
            {match.value}
          </span>
        );
      }
      
      lastIndex = match.end;
    });

    // Add remaining text
    if (lastIndex < content.length) {
      parts.push(content.slice(lastIndex));
    }

    return parts.length > 0 ? parts : content;
  };

  return (
    <div className="flex-1 overflow-hidden">
      <div className="h-full flex flex-col max-w-4xl mx-auto">
        {/* Filter Status and Sort Controls */}
        <div className="px-4 py-2 bg-accent/10 border-b border-border">
          <div className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground">
              {(selectedTag || selectedFolder) ? (
                <>
                  Showing: 
                  {selectedTag && <span className="bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 px-2 py-1 rounded text-xs mr-2">#{selectedTag}</span>}
                  {selectedFolder && <span className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 px-2 py-1 rounded text-xs mr-2">📁 {selectedFolder}</span>}
                  ({sortedNotes.length} notes)
                </>
              ) : (
                <>🏠 Home - Showing all notes ({sortedNotes.length} total)</>
              )}
            </div>
            
            {/* Download and Sort Controls */}
            <div className="flex items-center space-x-4">
              {/* Download Button */}
              <NoteDownload notes={sortedNotes} folderName={selectedFolder} />
              
              {/* Sort Controls */}
              <div className="flex items-center space-x-2">
                <span className="text-xs text-muted-foreground">Sort:</span>
              <Button
                variant={sortBy === 'newest' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSortBy('newest')}
                className="h-7 px-2 text-xs"
                data-testid="button-sort-newest"
              >
                <Clock className="w-3 h-3 mr-1" />
                Newest
              </Button>
              <Button
                variant={sortBy === 'oldest' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSortBy('oldest')}
                className="h-7 px-2 text-xs"
                data-testid="button-sort-oldest"
              >
                <Clock className="w-3 h-3 mr-1" />
                Oldest
              </Button>
              <Button
                variant={sortBy === 'mentions' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSortBy('mentions')}
                className="h-7 px-2 text-xs"
                data-testid="button-sort-mentions"
              >
                <Hash className="w-3 h-3 mr-1" />
                Variables
              </Button>
              </div>
            </div>
          </div>
        </div>
        
        {/* Notes List */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4">
          {Object.keys(notesByDate).length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div className="text-muted-foreground mb-2">
                {selectedTag ? `No notes found with tag "${selectedTag}"` : "No notes yet"}
              </div>
              <div className="text-sm text-muted-foreground">
                Start writing to create your first timestamped note
              </div>
            </div>
          ) : (
            Object.entries(notesByDate)
              .sort(([a], [b]) => b.localeCompare(a)) // Sort dates descending
              .map(([date, dayNotes]) => (
                <div key={date}>
                  {/* Date Header */}
                  <div className="flex items-center justify-center py-4">
                    <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                      <div className="h-px bg-border flex-1"></div>
                      <span className="px-3 bg-background">
                        {format(new Date(date), 'MMMM d, yyyy')}
                      </span>
                      <div className="h-px bg-border flex-1"></div>
                    </div>
                  </div>

                  {/* Notes for this date */}
                  <div className="space-y-4">
                    {dayNotes.map((note) => (
                        <div key={note.id} className="note-entry group relative" data-testid={`note-${note.id}`}>
                          <div className="flex items-start space-x-3">
                            <span className="timestamp text-muted-foreground mt-1 min-w-[60px] font-mono text-xs">
                              {format(new Date(note.createdAt), 'hh:mm a')}
                            </span>
                            <div className="flex-1">
                              {note.tags && note.tags.length > 0 && (
                                <div className="flex items-center mb-2 space-x-2">
                                  {note.tags.map((tag, index) => (
                                    <span
                                      key={tag}
                                      className={`inline-flex items-center px-2 py-1 rounded-full text-xs ${
                                        tagColors[index % tagColors.length]
                                      }`}
                                      data-testid={`tag-${tag}`}
                                    >
                                      <span className="w-1.5 h-1.5 rounded-full mr-1 opacity-60" />
                                      {tag}
                                    </span>
                                  ))}
                                </div>
                              )}
                              {note.folder && note.folder !== "General" && (
                                <div className="text-xs text-muted-foreground mb-1">
                                  📁 {note.folder}
                                </div>
                              )}
                              <div className="note-content text-foreground font-serif leading-relaxed" style={{ fontSize: 'var(--notes-font-size, 14px)' }}>
                                {renderContentWithHighlights(note.originalContent || note.content)}
                              </div>
                            </div>
                            
                            {/* Delete button - now shows on all notes on hover */}
                            <button
                              onClick={() => {
                                if (confirm("Delete this note?")) {
                                  deleteNoteMutation.mutate(note.id);
                                }
                              }}
                              className="opacity-0 group-hover:opacity-100 absolute top-1 right-1 p-1 text-muted-foreground hover:text-red-500 transition-all duration-200"
                              title="Delete note"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              ))
          )}
        </div>

        {/* Input Area */}
        <NoteInput />
      </div>
    </div>
  );
}
