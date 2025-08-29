import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Settings, Download, Filter, Moon, Sun, Menu } from "lucide-react";
import { useThemeContext } from "./theme-provider";
import type { Note, Variable } from "@shared/schema";

interface MobileSidebarProps {
  onSettingsClick: () => void;
  selectedTag: string | null;
  onTagSelect: (tag: string | null) => void;
  selectedFolder?: string | null;
  onFolderSelect?: (folder: string | null) => void;
}

export default function MobileSidebar({ onSettingsClick, selectedTag, onTagSelect, selectedFolder, onFolderSelect }: MobileSidebarProps) {
  const { theme, toggleTheme } = useThemeContext();
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
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" data-testid="button-mobile-menu">
          <Menu className="h-4 w-4" />
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-80">
        <SheetHeader>
          <SheetTitle>NoteTimes</SheetTitle>
        </SheetHeader>
        
        <div className="flex flex-col h-full mt-6">
          {/* Quick Actions */}
          <div className="space-y-2">
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
              onClick={() => {
                onSettingsClick();
              }}
              data-testid="button-mobile-settings-menu"
            >
              <Settings className="w-4 h-4 mr-3" />
              Settings
            </Button>
            <Button
              variant="ghost"
              className="w-full justify-start"
              onClick={() => handleExport('text')}
              data-testid="button-mobile-export-text"
            >
              <Download className="w-4 h-4 mr-3" />
              Export Notes
            </Button>
            <Button
              variant={!selectedTag && !selectedFolder ? "secondary" : "ghost"}
              className="w-full justify-start"
              onClick={() => {
                onTagSelect(null);
                onFolderSelect?.(null);
              }}
              data-testid="button-mobile-clear-filter"
            >
              <Filter className="w-4 h-4 mr-3" />
              🏠 Home - All Notes
            </Button>
          </div>

          {/* Tags Filter */}
          {Object.keys(tagCounts).length > 0 && (
            <div className="mt-6">
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
                    data-testid={`button-mobile-tag-${tag}`}
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

          {/* Folders */}
          <div className="mt-6">
            <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">
              Folders
            </h3>
            <div className="space-y-1">
              {["General", ...folders.filter(f => f !== "General")].map((folder) => {
                const count = notes.filter(note => (note.folder || "General") === folder).length;
                return (
                  <Button
                    key={folder}
                    variant="ghost"
                    className={`w-full justify-between text-sm ${
                      selectedFolder === folder ? 'bg-accent text-accent-foreground' : ''
                    }`}
                    onClick={() => onFolderSelect?.(folder === selectedFolder ? null : folder)}
                    data-testid={`button-mobile-folder-${folder}`}
                  >
                    <span className="flex items-center">
                      📁 {folder}
                    </span>
                    <span className="text-xs text-muted-foreground">{count}</span>
                  </Button>
                );
              })}
            </div>
          </div>

          {/* Variables Quick Reference */}
          {variables.length > 0 && (
            <div className="mt-6">
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
      </SheetContent>
    </Sheet>
  );
}