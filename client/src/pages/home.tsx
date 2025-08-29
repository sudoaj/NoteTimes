import { useState } from "react";
import Sidebar from "@/components/sidebar";
import MobileSidebar from "@/components/mobile-sidebar";
import NotesArea from "@/components/notes-area";
import SettingsModal from "@/components/settings-modal";
import { Button } from "@/components/ui/button";
import { Settings, Moon, Sun } from "lucide-react";
import { useThemeContext } from "@/components/theme-provider";

export default function Home() {
  const [showSettings, setShowSettings] = useState(false);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const { theme, toggleTheme } = useThemeContext();

  return (
    <div className="flex h-screen">
      {/* Desktop Sidebar */}
      <div className="hidden md:flex w-64 bg-card dark:bg-card border-r border-border dark:border-border">
        <Sidebar 
          onSettingsClick={() => setShowSettings(true)}
          selectedTag={selectedTag}
          onTagSelect={setSelectedTag}
          selectedFolder={selectedFolder}
          onFolderSelect={setSelectedFolder}
        />
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Mobile Header */}
        <div className="md:hidden flex items-center justify-between px-4 py-3 bg-card dark:bg-card border-b border-border dark:border-border">
          <h1 className="text-lg font-semibold">NoteTimes</h1>
          <div className="flex items-center space-x-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleTheme}
              data-testid="button-mobile-theme-toggle"
            >
              {theme === 'light' ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowSettings(true)}
              data-testid="button-mobile-settings"
            >
              <Settings className="h-4 w-4" />
            </Button>
            <MobileSidebar
              onSettingsClick={() => setShowSettings(true)}
              selectedTag={selectedTag}
              onTagSelect={setSelectedTag}
              selectedFolder={selectedFolder}
              onFolderSelect={setSelectedFolder}
            />
          </div>
        </div>

        <NotesArea selectedTag={selectedTag} selectedFolder={selectedFolder} />
      </div>

      <SettingsModal 
        open={showSettings} 
        onOpenChange={setShowSettings} 
      />
    </div>
  );
}
