import { useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Paperclip, Image, FileText } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface FileUploaderProps {
  onFileSelect: (file: File) => void;
  accept?: string;
  maxSize?: number; // in bytes
  className?: string;
}

export default function FileUploader({ 
  onFileSelect, 
  accept = "image/*,.pdf,.txt,.doc,.docx", 
  maxSize = 10 * 1024 * 1024, // 10MB
  className 
}: FileUploaderProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.size > maxSize) {
      toast({
        title: "File too large",
        description: `File size must be less than ${Math.round(maxSize / 1024 / 1024)}MB`,
        variant: "destructive",
      });
      return;
    }

    onFileSelect(file);
    
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const getIcon = () => {
    if (accept.includes('image')) return <Image className="w-4 h-4" />;
    if (accept.includes('.pdf') || accept.includes('.doc')) return <FileText className="w-4 h-4" />;
    return <Paperclip className="w-4 h-4" />;
  };

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept={accept}
        onChange={handleFileChange}
        className="hidden"
        data-testid="file-input"
      />
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className={`text-muted-foreground hover:text-foreground ${className}`}
        onClick={() => fileInputRef.current?.click()}
        data-testid="button-file-upload"
      >
        {getIcon()}
      </Button>
    </>
  );
}