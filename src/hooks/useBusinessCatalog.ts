import { useState, useCallback } from 'react';
import { codechatV2ApiService } from '@/services/codechatV2ApiService';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { Database } from '@/integrations/supabase/types';

type BusinessCollection = Database['public']['Tables']['business_collections']['Row'];
type BusinessProduct = Database['public']['Tables']['business_products']['Row'];

// Tipos para criação/atualização
type BusinessCollectionInsert = Database['public']['Tables']['business_collections']['Insert'];
type BusinessProductInsert = Database['public']['Tables']['business_products']['Insert'];

export const useBusinessCatalog = () => {
  const [collections, setCollections] = useState<BusinessCollection[]>([]);
  const [products, setProducts] = useState<BusinessProduct[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  // ============ COLLECTIONS ============
  const loadCollections = useCallback(async (businessId: string) => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('business_collections')
        .select('*')
        .eq('business_id', businessId)
        .order('position', { ascending: true });

      if (error) throw error;
      setCollections(data || []);
    } catch (error: any) {
      console.error('❌ [COLLECTIONS] Erro ao carregar:', error);
      toast({
        title: "Erro ao carregar coleções",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  const createCollection = useCallback(async (businessId: string, collectionData: {
    name: string;
    description?: string;
    image_url?: string;
  }) => {
    try {
      setIsLoading(true);
      
      // Inserir no Supabase
      const { data, error } = await supabase
        .from('business_collections')
        .insert({
          business_id: businessId,
          ...collectionData,
          position: collections.length
        })
        .select()
        .single();

      if (error) throw error;

      setCollections(prev => [...prev, data]);
      
      toast({
        title: "Coleção criada",
        description: `Coleção "${collectionData.name}" criada com sucesso`
      });

      return data;
    } catch (error: any) {
      console.error('❌ [COLLECTIONS] Erro ao criar:', error);
      toast({
        title: "Erro ao criar coleção",
        description: error.message,
        variant: "destructive"
      });
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [collections.length, toast]);

  const updateCollection = useCallback(async (collectionId: string, updates: Partial<BusinessCollection>) => {
    try {
      setIsLoading(true);
      
      const { data, error } = await supabase
        .from('business_collections')
        .update(updates)
        .eq('id', collectionId)
        .select()
        .single();

      if (error) throw error;

      setCollections(prev => prev.map(c => c.id === collectionId ? data : c));
      
      toast({
        title: "Coleção atualizada",
        description: "Coleção atualizada com sucesso"
      });

      return data;
    } catch (error: any) {
      console.error('❌ [COLLECTIONS] Erro ao atualizar:', error);
      toast({
        title: "Erro ao atualizar coleção",
        description: error.message,
        variant: "destructive"
      });
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  const deleteCollection = useCallback(async (collectionId: string) => {
    try {
      setIsLoading(true);
      
      const { error } = await supabase
        .from('business_collections')
        .delete()
        .eq('id', collectionId);

      if (error) throw error;

      setCollections(prev => prev.filter(c => c.id !== collectionId));
      
      toast({
        title: "Coleção removida",
        description: "Coleção removida com sucesso"
      });
    } catch (error: any) {
      console.error('❌ [COLLECTIONS] Erro ao deletar:', error);
      toast({
        title: "Erro ao remover coleção",
        description: error.message,
        variant: "destructive"
      });
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  // ============ PRODUCTS ============
  const loadProducts = useCallback(async (businessId: string, collectionId?: string) => {
    try {
      setIsLoading(true);
      let query = supabase
        .from('business_products')
        .select('*')
        .eq('business_id', businessId);

      if (collectionId) {
        query = query.eq('collection_id', collectionId);
      }

      const { data, error } = await query.order('position', { ascending: true });

      if (error) throw error;
      setProducts(data || []);
    } catch (error: any) {
      console.error('❌ [PRODUCTS] Erro ao carregar:', error);
      toast({
        title: "Erro ao carregar produtos",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  const createProduct = useCallback(async (businessId: string, productData: {
    collection_id?: string;
    name: string;
    description?: string;
    price?: number;
    currency?: string;
    sku?: string;
    stock_quantity?: number;
    images?: string[];
    metadata?: any;
  }) => {
    try {
      setIsLoading(true);
      
      const { data, error } = await supabase
        .from('business_products')
        .insert({
          business_id: businessId,
          currency: 'BRL',
          stock_quantity: 0,
          images: [],
          metadata: {},
          ...productData,
          position: products.length
        })
        .select()
        .single();

      if (error) throw error;

      setProducts(prev => [...prev, data]);
      
      toast({
        title: "Produto criado",
        description: `Produto "${productData.name}" criado com sucesso`
      });

      return data;
    } catch (error: any) {
      console.error('❌ [PRODUCTS] Erro ao criar:', error);
      toast({
        title: "Erro ao criar produto",
        description: error.message,
        variant: "destructive"
      });
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [products.length, toast]);

  const updateProduct = useCallback(async (productId: string, updates: Partial<BusinessProduct>) => {
    try {
      setIsLoading(true);
      
      const { data, error } = await supabase
        .from('business_products')
        .update(updates)
        .eq('id', productId)
        .select()
        .single();

      if (error) throw error;

      setProducts(prev => prev.map(p => p.id === productId ? data : p));
      
      toast({
        title: "Produto atualizado",
        description: "Produto atualizado com sucesso"
      });

      return data;
    } catch (error: any) {
      console.error('❌ [PRODUCTS] Erro ao atualizar:', error);
      toast({
        title: "Erro ao atualizar produto",
        description: error.message,
        variant: "destructive"
      });
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  const deleteProduct = useCallback(async (productId: string) => {
    try {
      setIsLoading(true);
      
      const { error } = await supabase
        .from('business_products')
        .delete()
        .eq('id', productId);

      if (error) throw error;

      setProducts(prev => prev.filter(p => p.id !== productId));
      
      toast({
        title: "Produto removido",
        description: "Produto removido com sucesso"
      });
    } catch (error: any) {
      console.error('❌ [PRODUCTS] Erro ao deletar:', error);
      toast({
        title: "Erro ao remover produto",
        description: error.message,
        variant: "destructive"
      });
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  // ============ MESSAGING ============
  const sendCatalogMessage = useCallback(async (instanceJWT: string, instanceId: string, chatId: string, messageData: {
    header?: string;
    body: string;
    footer?: string;
    action_text?: string;
  }) => {
    try {
      const result = await codechatV2ApiService.sendCatalogMessage(instanceJWT, instanceId, chatId, messageData);
      
      toast({
        title: "Catálogo enviado",
        description: "Mensagem de catálogo enviada com sucesso"
      });

      return result;
    } catch (error: any) {
      console.error('❌ [CATALOG] Erro ao enviar catálogo:', error);
      toast({
        title: "Erro ao enviar catálogo",
        description: error.message,
        variant: "destructive"
      });
      throw error;
    }
  }, [toast]);

  const sendProductMessage = useCallback(async (instanceJWT: string, instanceId: string, chatId: string, messageData: {
    product_id: string;
    header?: string;
    body: string;
    footer?: string;
  }) => {
    try {
      const result = await codechatV2ApiService.sendProductMessage(instanceJWT, instanceId, chatId, messageData);
      
      toast({
        title: "Produto enviado",
        description: "Mensagem de produto enviada com sucesso"
      });

      return result;
    } catch (error: any) {
      console.error('❌ [PRODUCT] Erro ao enviar produto:', error);
      toast({
        title: "Erro ao enviar produto",
        description: error.message,
        variant: "destructive"
      });
      throw error;
    }
  }, [toast]);

  return {
    // State
    collections,
    products,
    isLoading,

    // Collections
    loadCollections,
    createCollection,
    updateCollection,
    deleteCollection,

    // Products
    loadProducts,
    createProduct,
    updateProduct,
    deleteProduct,

    // Messaging
    sendCatalogMessage,
    sendProductMessage
  };
};