import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Settings, Download, Filter, Moon, Sun, Folder, FolderOpen, Plus, Trash2 } from "lucide-react";
import { useThemeContext } from "./theme-provider";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { Note, Variable } from "@shared/schema";

interface SidebarProps {
  onSettingsClick: () => void;
  selectedTag: string | null;
  onTagSelect: (tag: string | null) => void;
  selectedFolder?: string | null;
  onFolderSelect?: (folder: string | null) => void;
}

export default function Sidebar({ onSettingsClick, selectedTag, onTagSelect, selectedFolder, onFolderSelect }: SidebarProps) {
  const { theme, toggleTheme } = useThemeContext();
  const { toast } = useToast();
  const { data: notes = [] } = useQuery<Note[]>({
    queryKey: ["/api/notes"],
  });

  const { data: variables = [] } = useQuery<Variable[]>({
    queryKey: ["/api/variables"],
  });

  const { data: folders = [] } = useQuery<string[]>({
    queryKey: ["/api/folders"],
  });

  // Get unique tags with counts
  const tagCounts = notes.reduce((acc, note) => {
    note.tags?.forEach(tag => {
      acc[tag] = (acc[tag] || 0) + 1;
    });
    return acc;
  }, {} as Record<string, number>);

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
    } catch (error) {
      console.error('Export failed:', error);
    }
  };

  const tagColors = [
    'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
    'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300', 
    'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
    'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
    'bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-300',
    'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300',
  ];

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-6 border-b border-border">
        <h1 className="text-xl font-semibold text-foreground">NoteTimes</h1>
        <p className="text-sm text-muted-foreground mt-1">Enhanced with variables</p>
      </div>
      
      {/* Quick Actions */}
      <div className="p-4 space-y-2">
        <Button
          variant="ghost"
          className="w-full justify-start"
          onClick={toggleTheme}
          data-testid="button-toggle-theme"
        >
          {theme === 'light' ? <Moon className="w-4 h-4 mr-3" /> : <Sun className="w-4 h-4 mr-3" />}
          {theme === 'light' ? 'Dark Mode' : 'Light Mode'}
        </Button>
        <Button
          variant="ghost"
          className="w-full justify-start"
          onClick={onSettingsClick}
          data-testid="button-settings"
        >
          <Settings className="w-4 h-4 mr-3" />
          Settings
        </Button>
        <Button
          variant="ghost"
          className="w-full justify-start"
          onClick={() => handleExport('text')}
          data-testid="button-export-text"
        >
          <Download className="w-4 h-4 mr-3" />
          Export Notes
        </Button>
        <Button
          variant={!selectedTag && !selectedFolder ? "secondary" : "ghost"}
          className="w-full justify-start"
          onClick={() => {
            onTagSelect?.(null);
            onFolderSelect?.(null);
          }}
          data-testid="button-clear-filter"
        >
          <Filter className="w-4 h-4 mr-3" />
          🏠 Home - All Notes
        </Button>
      </div>

      {/* Folders Section */}
      <div className="p-4 border-t border-border">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Folders
          </h3>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0"
            onClick={async () => {
              const folderName = prompt("Enter folder name:");
              if (folderName && folderName.trim()) {
                try {
                  await apiRequest("POST", "/api/folders", { name: folderName.trim() });
                  onFolderSelect?.(folderName.trim());
                  toast({
                    title: "Folder created",
                    description: `"${folderName.trim()}" is ready for your notes.`,
                  });
                } catch (error) {
                  toast({
                    title: "Error",
                    description: "Failed to create folder. Please try again.",
                    variant: "destructive",
                  });
                }
              }
            }}
            data-testid="button-add-folder"
          >
            <Plus className="h-3 w-3" />
          </Button>
        </div>
        <div className="space-y-1">
          <Button
            variant={!selectedFolder ? "secondary" : "ghost"}
            size="sm"
            className="w-full justify-between text-left"
            onClick={() => onFolderSelect?.(null)}
            data-testid="folder-all"
          >
            <span>All Folders</span>
            <span className="text-xs text-muted-foreground">{notes.length}</span>
          </Button>
          {["General", ...folders.filter(f => f !== "General")].map(folder => {
            const count = notes.filter(note => (note.folder || "General") === folder).length;
            return (
              <Button
                key={folder}
                variant={selectedFolder === folder ? "secondary" : "ghost"}
                size="sm"
                className="w-full justify-between text-left"
                onClick={() => onFolderSelect?.(folder)}
                data-testid={`folder-${folder}`}
              >
                <span className="flex items-center">
                  {selectedFolder === folder ? <FolderOpen className="w-3 h-3 mr-2" /> : <Folder className="w-3 h-3 mr-2" />}
                  {folder}
                </span>
                <span className="text-xs text-muted-foreground">{count}</span>
              </Button>
            );
          })}
        </div>
      </div>

      {/* Tags Filter */}
      {Object.keys(tagCounts).length > 0 && (
        <div className="p-4">
          <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">
            Tags
          </h3>
          <div className="space-y-1">
            {Object.entries(tagCounts).map(([tag, count], index) => (
              <Button
                key={tag}
                variant="ghost"
                className={`w-full justify-between text-sm ${
                  selectedTag === tag ? 'bg-accent text-accent-foreground' : ''
                }`}
                onClick={() => onTagSelect(tag === selectedTag ? null : tag)}
                data-testid={`button-tag-${tag}`}
              >
                <span className="flex items-center">
                  <span className={`w-2 h-2 rounded-full mr-2 ${
                    tagColors[index % tagColors.length].split(' ')[0]
                  }`} />
                  {tag}
                </span>
                <span className="text-xs text-muted-foreground">{count}</span>
              </Button>
            ))}
          </div>
        </div>
      )}

      {/* Variables Quick Reference */}
      {variables.length > 0 && (
        <div className="p-4 mt-auto">
          <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">
            Variables
          </h3>
          <div className="space-y-1 text-xs">
            {variables.slice(0, 5).map((variable) => (
              <div key={variable.id} className="flex items-center justify-between py-1">
                <code className="text-primary">/{variable.name}</code>
                <span className="text-muted-foreground truncate ml-2 max-w-[100px]">
                  {variable.values && variable.values.length > 0 ? variable.values[0] : 'No values'}
                </span>
              </div>
            ))}
            {variables.length > 5 && (
              <div className="text-muted-foreground text-center pt-1">
                +{variables.length - 5} more
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
