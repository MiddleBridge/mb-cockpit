"use client";

import { useState, useEffect } from "react";
import * as categoriesDb from "../../lib/db/categories";
import * as rolesDb from "../../lib/db/roles";

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
  status?: 'ongoing' | 'freezed' | 'lost' | 'active_but_ceased' | null;
  priority: 'low' | 'mid' | 'prio' | 'high prio';
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
        status: undefined, // Don't set status - let it be null/empty
        priority: 'mid',
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

  const updateOrganisation = async (orgId: string, updates: { name?: string; categories?: string[]; status?: 'ongoing' | 'freezed' | 'lost' | 'active_but_ceased'; priority?: 'low' | 'mid' | 'prio' | 'high prio' }) => {
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

export function useRoles() {
  const [roles, setRoles] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadRoles();
  }, []);

  const loadRoles = async () => {
    try {
      setLoading(true);
      const data = await rolesDb.getRoles();
      setRoles(data);
    } catch (error) {
      console.error("Error loading roles:", error);
    } finally {
      setLoading(false);
    }
  };

  const addRole = async (role: string) => {
    if (role.trim() && !roles.includes(role.trim())) {
      const result = await rolesDb.createRole(role.trim());
      if (result) {
        await loadRoles();
      }
    }
  };

  const deleteRole = async (roleName: string) => {
    const success = await rolesDb.deleteRoleByName(roleName);
    if (success) {
      await loadRoles();
    }
  };

  return { roles, addRole, deleteRole, loading };
}

