import { Download, ChevronDown } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect, useRef } from "react";
import type { Note, Variable } from "@shared/schema";
import { useQuery } from "@tanstack/react-query";

interface NoteDownloadProps {
  notes: Note[];
  folderName?: string;
}

export default function NoteDownload({ notes, folderName }: NoteDownloadProps) {
  const { toast } = useToast();
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const { data: variables = [] } = useQuery<Variable[]>({
    queryKey: ["/api/variables"],
  });

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);


  const downloadNotesAsHTML = () => {
    const sortedNotes = [...notes].sort((a, b) => 
      new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );
    
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${folderName ? `${folderName} Notes` : 'Notes'} - ${format(new Date(), 'MMM d, yyyy')}</title>
    <style>
        body {
            font-family: Georgia, serif;
            line-height: 1.6;
            max-width: 900px;
            margin: 0 auto;
            padding: 40px 20px;
            color: #333;
        }
        .header {
            border-bottom: 2px solid #ddd;
            margin-bottom: 30px;
            padding-bottom: 15px;
        }
        .title {
            font-size: 24px;
            font-weight: bold;
            color: #333;
            margin-bottom: 8px;
        }
        .subtitle {
            color: #666;
            font-size: 14px;
        }
        .note {
            margin-bottom: 40px;
            border-bottom: 1px solid #eee;
            padding-bottom: 30px;
        }
        .note:last-child {
            border-bottom: none;
        }
        .note-header {
            margin-bottom: 15px;
        }
        .timestamp {
            color: #666;
            font-size: 14px;
            font-weight: bold;
            margin-bottom: 8px;
        }
        .tags {
            margin: 8px 0;
        }
        .tag {
            background: #e3f2fd;
            color: #1976d2;
            padding: 4px 12px;
            border-radius: 16px;
            font-size: 12px;
            margin-right: 8px;
            display: inline-block;
        }
        .folder-info {
            color: #666;
            font-size: 14px;
            margin-bottom: 8px;
        }
        .content {
            font-size: 16px;
            line-height: 1.7;
            white-space: pre-wrap;
            margin-top: 15px;
        }
        .variable {
            background: linear-gradient(to right, #f0f0ff 0%, #e8e8ff 100%);
            color: #6b46c1;
            padding: 2px 8px;
            margin: 0 2px;
            border-radius: 6px;
            font-weight: 600;
            border: 1px solid #c4b5fd;
            box-shadow: 0 1px 2px rgba(107, 70, 193, 0.1);
            display: inline-block;
        }
        .footer {
            margin-top: 60px;
            padding-top: 20px;
            border-top: 1px solid #eee;
            font-size: 12px;
            color: #999;
            text-align: center;
        }
        .stats {
            background: #f8f9fa;
            padding: 15px;
            border-radius: 8px;
            margin-bottom: 30px;
            font-size: 14px;
            color: #666;
        }
    </style>
</head>
<body>
    <div class="header">
        <div class="title">${folderName ? `${folderName} Notes` : 'All Notes'}</div>
        <div class="subtitle">Generated on ${format(new Date(), 'MMMM d, yyyy h:mm a')}</div>
    </div>
    
    <div class="stats">
        Total Notes: ${sortedNotes.length} | Date Range: ${format(new Date(sortedNotes[0]?.createdAt), 'MMM d, yyyy')} - ${format(new Date(sortedNotes[sortedNotes.length - 1]?.createdAt), 'MMM d, yyyy')}
    </div>
    
    ${sortedNotes.map(note => {
      // Start with the content that has both variables and resolved values
      let content = note.content || note.originalContent;
      
      // Escape HTML to prevent issues
      content = content.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      
      // Process resolved variable values first (text wrapped in zero-width spaces)
      content = content.replace(/\u200B([^\u200B]+)\u200B/g, '<span class="variable">$1</span>');
      
      // Process variable references (like /user, /company, etc.)
      if (variables.length > 0) {
        variables.forEach(variable => {
          const variablePattern = new RegExp(`\\/${variable.name}\\b`, 'g');
          content = content.replace(variablePattern, '<span class="variable">/${variable.name}</span>');
        });
      }
      
      return `
    <div class="note">
        <div class="note-header">
            <div class="timestamp">${format(new Date(note.createdAt), 'MMMM d, yyyy h:mm a')}</div>
            ${note.tags && note.tags.length > 0 ? `
            <div class="tags">
                ${note.tags.map(tag => `<span class="tag">#${tag}</span>`).join('')}
            </div>
            ` : ''}
            ${note.folder && note.folder !== 'General' && !folderName ? `
            <div class="folder-info">Folder: ${note.folder}</div>
            ` : ''}
        </div>
        <div class="content">${content.replace(/\n/g, '<br>')}</div>
    </div>
    `;
    }).join('')}
    
    <div class="footer">
        Generated from NoteTimes
    </div>
</body>
</html>`;

    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const fileName = folderName 
      ? `${folderName}-notes-${format(new Date(), 'yyyy-MM-dd')}.html`
      : `all-notes-${format(new Date(), 'yyyy-MM-dd')}.html`;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast({
      title: "Notes Downloaded",
      description: `${sortedNotes.length} notes saved as HTML file that you can open in Google Docs.`,
    });
  };

  const downloadNotesAsMarkdown = () => {
    const sortedNotes = [...notes].sort((a, b) => 
      new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );

    let markdownContent = `# ${folderName ? `${folderName} Notes` : 'All Notes'}\n\n`;
    markdownContent += `*Generated on ${format(new Date(), 'MMMM d, yyyy h:mm a')}*\n\n`;
    markdownContent += `**Total Notes:** ${sortedNotes.length}  \n`;
    markdownContent += `**Date Range:** ${format(new Date(sortedNotes[0]?.createdAt), 'MMM d, yyyy')} - ${format(new Date(sortedNotes[sortedNotes.length - 1]?.createdAt), 'MMM d, yyyy')}\n\n`;

    sortedNotes.forEach((note, index) => {
      markdownContent += `## Note ${index + 1}\n\n`;
      markdownContent += `**Date:** ${format(new Date(note.createdAt), 'MMMM d, yyyy h:mm a')}\n\n`;
      
      if (note.tags && note.tags.length > 0) {
        markdownContent += `**Tags:** ${note.tags.map(tag => `#${tag}`).join(', ')}\n\n`;
      }
      
      if (note.folder && note.folder !== 'General' && !folderName) {
        markdownContent += `**Folder:** ${note.folder}\n\n`;
      }
      
      // Process content for markdown with backticks
      let content = note.content || note.originalContent;
      
      // Process resolved variable values first (text wrapped in zero-width spaces)
      content = content.replace(/\u200B([^\u200B]+)\u200B/g, '`$1`');
      
      // Process variable references (like /user, /company, etc.)
      if (variables.length > 0) {
        variables.forEach(variable => {
          const variablePattern = new RegExp(`\\/${variable.name}\\b`, 'g');
          content = content.replace(variablePattern, `\`/${variable.name}\``);
        });
      }
      
      markdownContent += `${content}\n\n`;
      
      if (index < sortedNotes.length - 1) {
        markdownContent += `---\n\n`;
      }
    });

    const blob = new Blob([markdownContent], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const fileName = folderName 
      ? `${folderName}-notes-${format(new Date(), 'yyyy-MM-dd')}.md`
      : `all-notes-${format(new Date(), 'yyyy-MM-dd')}.md`;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast({
      title: "Notes Downloaded",
      description: `${sortedNotes.length} notes saved as Markdown file.`,
    });
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setShowDropdown(!showDropdown)}
        className="flex items-center space-x-1 px-2 py-1 text-xs bg-blue-500 hover:bg-blue-600 text-white rounded transition-colors duration-200"
        title={`Download ${notes.length} notes`}
      >
        <Download className="w-3 h-3" />
        <span>Download</span>
        <ChevronDown className="w-3 h-3" />
      </button>
      
      {showDropdown && (
        <div className="absolute right-0 mt-1 bg-white border border-gray-200 rounded-md shadow-lg z-10 min-w-[120px]">
          <button
            onClick={() => {
              downloadNotesAsHTML();
              setShowDropdown(false);
            }}
            className="block w-full px-3 py-2 text-left text-sm hover:bg-gray-50 text-gray-700"
          >
            HTML File
          </button>
          <button
            onClick={() => {
              downloadNotesAsMarkdown();
              setShowDropdown(false);
            }}
            className="block w-full px-3 py-2 text-left text-sm hover:bg-gray-50 text-gray-700"
          >
            Markdown
          </button>
        </div>
      )}
    </div>
  );
}