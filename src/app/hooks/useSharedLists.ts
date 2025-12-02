"use client";

import { useState, useEffect } from "react";
import * as categoriesDb from "../../lib/db/categories";

export function useCategories() {
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadCategories();
  }, []);

  const loadCategories = async () => {
    try {
      setLoading(true);
      const data = await categoriesDb.getCategories();
      setCategories(data);
    } catch (error) {
      console.error("Error loading categories:", error);
    } finally {
      setLoading(false);
    }
  };

  const addCategory = async (category: string) => {
    if (category.trim() && !categories.includes(category.trim())) {
      const result = await categoriesDb.createCategory(category.trim());
      if (result) {
        await loadCategories();
      }
    }
  };

  const deleteCategory = async (categoryName: string) => {
    const success = await categoriesDb.deleteCategoryByName(categoryName);
    if (success) {
      await loadCategories();
    }
  };

  return { categories, addCategory, deleteCategory, loading };
}

export interface Organisation {
  id: string;
  name: string;
  categories: string[];
}

import * as organisationsDb from "../../lib/db/organisations";

export function useOrganisations() {
  const [organisations, setOrganisations] = useState<Organisation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadOrganisations();
  }, []);

  const loadOrganisations = async () => {
    try {
      setLoading(true);
      const data = await organisationsDb.getOrganisations();
      setOrganisations(data);
    } catch (error) {
      console.error("Error loading organisations:", error);
    } finally {
      setLoading(false);
    }
  };

  const addOrganisation = async (orgName: string) => {
    if (orgName.trim() && !organisations.some((o) => o.name === orgName.trim())) {
      const result = await organisationsDb.createOrganisation({
        name: orgName.trim(),
        categories: [],
      });
      if (result) {
        await loadOrganisations();
      }
    }
  };

  const deleteOrganisation = async (orgId: string) => {
    const success = await organisationsDb.deleteOrganisation(orgId);
    if (success) {
      await loadOrganisations();
    }
  };

  const updateOrganisationCategories = async (orgId: string, categories: string[]) => {
    const result = await organisationsDb.updateOrganisation(orgId, { categories });
    if (result) {
      await loadOrganisations();
    }
  };

  const updateOrganisation = async (orgId: string, updates: { name?: string; categories?: string[] }) => {
    const result = await organisationsDb.updateOrganisation(orgId, updates);
    if (result) {
      await loadOrganisations();
      return true;
    }
    return false;
  };

  return {
    organisations,
    addOrganisation,
    deleteOrganisation,
    updateOrganisationCategories,
    updateOrganisation,
    loading,
  };
}

