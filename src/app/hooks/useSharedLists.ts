"use client";

import { useState, useEffect } from "react";
import * as categoriesDb from "../../lib/db/categories";
import * as rolesDb from "../../lib/db/roles";
import * as locationsDb from "../../lib/db/locations";
import * as sectorsDb from "../../lib/db/sectors";
import * as websitesDb from "../../lib/db/websites";

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
  website?: string;
  location?: string;
  sector?: string;
  notes?: string;
  notes_updated_at?: string;
  avatar?: string;
}

import * as organisationsDb from "../../lib/db/organisations";

export function useOrganisations() {
  const [organisations, setOrganisations] = useState<Organisation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadOrganisations();
    
    // Listen for organisation updates
    const handleOrganisationUpdate = () => {
      loadOrganisations();
    };
    window.addEventListener('organisations-updated', handleOrganisationUpdate);
    
    return () => {
      window.removeEventListener('organisations-updated', handleOrganisationUpdate);
    };
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

  const updateOrganisation = async (orgId: string, updates: { name?: string; categories?: string[]; status?: 'ongoing' | 'freezed' | 'lost' | 'active_but_ceased'; priority?: 'low' | 'mid' | 'prio' | 'high prio'; location?: string; website?: string; sector?: string }) => {
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

export function useLocations() {
  const [locations, setLocations] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadLocations();
  }, []);

  const loadLocations = async () => {
    try {
      setLoading(true);
      const data = await locationsDb.getLocations();
      setLocations(data.map(l => l.name));
    } catch (error) {
      console.error("Error loading locations:", error);
    } finally {
      setLoading(false);
    }
  };

  const addLocation = async (location: string) => {
    if (location.trim() && !locations.includes(location.trim())) {
      const result = await locationsDb.addLocation(location.trim());
      if (result) {
        await loadLocations();
      }
    }
  };

  return { locations, addLocation, loading };
}

export function useSectors() {
  const [sectors, setSectors] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSectors();
  }, []);

  const loadSectors = async () => {
    try {
      setLoading(true);
      const data = await sectorsDb.getSectors();
      setSectors(data.map(s => s.name));
    } catch (error) {
      console.error("Error loading sectors:", error);
    } finally {
      setLoading(false);
    }
  };

  const addSector = async (sector: string) => {
    if (sector.trim() && !sectors.includes(sector.trim())) {
      const result = await sectorsDb.addSector(sector.trim());
      if (result) {
        await loadSectors();
      }
    }
  };

  return { sectors, addSector, loading };
}

export function useWebsites() {
  const [websites, setWebsites] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadWebsites();
  }, []);

  const loadWebsites = async () => {
    try {
      setLoading(true);
      const data = await websitesDb.getWebsites();
      setWebsites(data.map(w => w.url));
    } catch (error) {
      console.error("Error loading websites:", error);
    } finally {
      setLoading(false);
    }
  };

  const addWebsite = async (website: string) => {
    if (website.trim() && !websites.includes(website.trim())) {
      const result = await websitesDb.addWebsite(website.trim());
      if (result) {
        await loadWebsites();
      }
    }
  };

  return { websites, addWebsite, loading };
}

