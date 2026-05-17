export type ZohoTokens = {
  access_token: string;
  refresh_token?: string;
  expires_in: number; // seconds
  api_domain: string;
  token_type: string;
};

export type ZohoOrganization = {
  organization_id: string;
  name: string;
  currency_code: string;
};

export type ZohoContact = {
  contact_id: string;
  contact_name: string;
  company_name?: string;
  email?: string;
  phone?: string;
  mobile?: string;
  status?: string;
  created_time?: string;
  last_modified_time?: string;
};

export type ZohoInvoice = {
  invoice_id: string;
  customer_id: string;
  customer_name: string;
  invoice_number: string;
  status: string;       // draft | sent | viewed | overdue | paid | void
  total: number;
  date: string;         // YYYY-MM-DD
  due_date?: string;
  created_time: string;
  last_modified_time: string;
};

export type ZohoItem = {
  item_id: string;
  name: string;
  sku?: string;
  rate?: number;
  unit?: string;
  status?: string;
};

export type IntegrationRow = {
  id: string;
  team_id: string;
  provider: string;
  access_token: string | null;
  refresh_token: string | null;
  expires_at: string | null;
  config: { organization_id?: string; api_domain?: string } | null;
  connected_at: string | null;
  last_synced_at: string | null;
  last_sync_error: string | null;
};
