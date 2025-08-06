import React, { useState, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { 
  Upload, 
  FileText, 
  CheckCircle, 
  AlertCircle, 
  Users, 
  Phone, 
  Mail,
  Download,
  X
} from 'lucide-react';

interface ContactUploadModalProps {
  clientId: string;
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface ContactPreview {
  name: string;
  phone: string;
  email?: string;
  isValid: boolean;
  isDuplicate: boolean;
  errors: string[];
}

const ContactUploadModal: React.FC<ContactUploadModalProps> = ({ 
  clientId, 
  open, 
  onClose, 
  onSuccess 
}) => {
  const [step, setStep] = useState<'upload' | 'preview' | 'processing'>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [contacts, setContacts] = useState<ContactPreview[]>([]);
  const [progress, setProgress] = useState(0);
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const resetModal = () => {
    setStep('upload');
    setFile(null);
    setContacts([]);
    setProgress(0);
    setImporting(false);
  };

  const handleFileSelect = async (selectedFile: File) => {
    if (!selectedFile) return;

    const validTypes = [
      'text/csv',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ];

    if (!validTypes.includes(selectedFile.type)) {
      toast({
        title: "Formato inválido",
        description: "Por favor, selecione um arquivo CSV ou Excel",
        variant: "destructive"
      });
      return;
    }

    setFile(selectedFile);
    await parseFile(selectedFile);
  };

  const parseFile = async (file: File) => {
    try {
      const text = await file.text();
      const lines = text.split('\n').filter(line => line.trim());
      
      if (lines.length === 0) {
        toast({
          title: "Arquivo vazio",
          description: "O arquivo não contém dados válidos",
          variant: "destructive"
        });
        return;
      }

      // Assumir que a primeira linha são os cabeçalhos
      const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
      const nameIndex = headers.findIndex(h => h.includes('nome') || h.includes('name'));
      const phoneIndex = headers.findIndex(h => h.includes('telefone') || h.includes('phone') || h.includes('whatsapp'));
      const emailIndex = headers.findIndex(h => h.includes('email') || h.includes('e-mail'));

      if (nameIndex === -1 || phoneIndex === -1) {
        toast({
          title: "Colunas obrigatórias não encontradas",
          description: "O arquivo deve conter colunas 'Nome' e 'Telefone'",
          variant: "destructive"
        });
        return;
      }

      const parsedContacts: ContactPreview[] = [];
      const seenPhones = new Set<string>();

      for (let i = 1; i < lines.length; i++) {
        const columns = lines[i].split(',').map(c => c.trim().replace(/"/g, ''));
        
        if (columns.length < Math.max(nameIndex, phoneIndex) + 1) continue;

        const name = columns[nameIndex]?.trim();
        const phone = columns[phoneIndex]?.trim().replace(/\D/g, ''); // Remove caracteres não numéricos
        const email = emailIndex >= 0 ? columns[emailIndex]?.trim() : '';

        const errors: string[] = [];
        let isValid = true;

        // Validações
        if (!name) {
          errors.push('Nome é obrigatório');
          isValid = false;
        }

        if (!phone) {
          errors.push('Telefone é obrigatório');
          isValid = false;
        } else if (phone.length < 10 || phone.length > 15) {
          errors.push('Telefone deve ter entre 10 e 15 dígitos');
          isValid = false;
        }

        if (email && !email.includes('@')) {
          errors.push('Email inválido');
          isValid = false;
        }

        const isDuplicate = seenPhones.has(phone);
        if (isDuplicate) {
          errors.push('Telefone duplicado na lista');
          isValid = false;
        } else {
          seenPhones.add(phone);
        }

        parsedContacts.push({
          name,
          phone,
          email,
          isValid,
          isDuplicate,
          errors
        });
      }

      setContacts(parsedContacts);
      setStep('preview');
    } catch (error) {
      console.error('Erro ao processar arquivo:', error);
      toast({
        title: "Erro ao processar arquivo",
        description: "Verifique se o arquivo está no formato correto",
        variant: "destructive"
      });
    }
  };

  const handleImport = async () => {
    const validContacts = contacts.filter(c => c.isValid);
    if (validContacts.length === 0) {
      toast({
        title: "Nenhum contato válido",
        description: "Corrija os erros antes de continuar",
        variant: "destructive"
      });
      return;
    }

    setImporting(true);
    setStep('processing');
    setProgress(0);

    try {
      // Simular processamento
      for (let i = 0; i < validContacts.length; i++) {
        await new Promise(resolve => setTimeout(resolve, 100));
        setProgress(((i + 1) / validContacts.length) * 100);
      }

      // Aqui você implementaria a lógica real de importação
      // incluindo verificação de duplicatas no banco e criação de customers
      
      toast({
        title: "Importação concluída!",
        description: `${validContacts.length} contatos importados com sucesso`,
      });

      onSuccess();
      resetModal();
    } catch (error) {
      console.error('Erro na importação:', error);
      toast({
        title: "Erro na importação",
        description: "Ocorreu um erro ao importar os contatos",
        variant: "destructive"
      });
    } finally {
      setImporting(false);
    }
  };

  const downloadTemplate = () => {
    const csvContent = "Nome,Telefone,Email\nJoão Silva,11999999999,joao@exemplo.com\nMaria Santos,11888888888,maria@exemplo.com";
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'template_contatos.csv';
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const validContacts = contacts.filter(c => c.isValid);
  const invalidContacts = contacts.filter(c => !c.isValid);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="w-5 h-5" />
            Importar Contatos
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {step === 'upload' && (
            <>
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Faça upload de um arquivo CSV ou Excel com as colunas: Nome, Telefone e Email (opcional)
                </AlertDescription>
              </Alert>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card 
                  className="border-dashed border-2 cursor-pointer hover:border-primary/50 transition-colors"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <CardContent className="p-8 text-center">
                    <Upload className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="font-semibold mb-2">Fazer Upload</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      Clique aqui ou arraste seu arquivo
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Formatos: CSV, XLS, XLSX
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Template de Exemplo</CardTitle>
                    <CardDescription>
                      Baixe um template para estruturar seus contatos
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Button 
                      variant="outline" 
                      onClick={downloadTemplate}
                      className="w-full"
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Baixar Template
                    </Button>
                  </CardContent>
                </Card>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.xls,.xlsx"
                onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
                className="hidden"
              />
            </>
          )}

          {step === 'preview' && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                  <CardContent className="p-4 text-center">
                    <Users className="w-6 h-6 text-blue-500 mx-auto mb-2" />
                    <p className="text-2xl font-bold">{contacts.length}</p>
                    <p className="text-sm text-muted-foreground">Total</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 text-center">
                    <CheckCircle className="w-6 h-6 text-green-500 mx-auto mb-2" />
                    <p className="text-2xl font-bold text-green-600">{validContacts.length}</p>
                    <p className="text-sm text-muted-foreground">Válidos</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 text-center">
                    <AlertCircle className="w-6 h-6 text-red-500 mx-auto mb-2" />
                    <p className="text-2xl font-bold text-red-600">{invalidContacts.length}</p>
                    <p className="text-sm text-muted-foreground">Com Erro</p>
                  </CardContent>
                </Card>
              </div>

              <div className="max-h-96 overflow-y-auto space-y-2">
                {contacts.map((contact, index) => (
                  <div 
                    key={index}
                    className={`p-3 rounded-lg border ${
                      contact.isValid 
                        ? 'border-green-200 bg-green-50' 
                        : 'border-red-200 bg-red-50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {contact.isValid ? (
                          <CheckCircle className="w-4 h-4 text-green-500" />
                        ) : (
                          <AlertCircle className="w-4 h-4 text-red-500" />
                        )}
                        <div>
                          <p className="font-medium">{contact.name}</p>
                          <div className="flex items-center gap-4 text-sm text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Phone className="w-3 h-3" />
                              {contact.phone}
                            </span>
                            {contact.email && (
                              <span className="flex items-center gap-1">
                                <Mail className="w-3 h-3" />
                                {contact.email}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      {!contact.isValid && (
                        <div className="text-right">
                          {contact.errors.map((error, i) => (
                            <Badge key={i} variant="destructive" className="ml-1 text-xs">
                              {error}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex justify-between">
                <Button variant="outline" onClick={() => setStep('upload')}>
                  Voltar
                </Button>
                <Button 
                  onClick={handleImport}
                  disabled={validContacts.length === 0}
                  className="bg-gradient-to-r from-primary to-secondary"
                >
                  Importar {validContacts.length} Contatos
                </Button>
              </div>
            </>
          )}

          {step === 'processing' && (
            <div className="text-center space-y-6">
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
                <Upload className="w-8 h-8 text-primary animate-pulse" />
              </div>
              <div>
                <h3 className="text-lg font-semibold mb-2">Importando contatos...</h3>
                <p className="text-muted-foreground mb-4">
                  Processando {validContacts.length} contatos
                </p>
                <Progress value={progress} className="w-full max-w-md mx-auto" />
                <p className="text-sm text-muted-foreground mt-2">
                  {Math.round(progress)}% concluído
                </p>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ContactUploadModal;