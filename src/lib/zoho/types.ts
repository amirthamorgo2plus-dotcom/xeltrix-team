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

export type ZohoAddress = {
  address?: string;
  street2?: string;
  city?: string;
  state?: string;
  zip?: string;
  country?: string;
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
  billing_address?: ZohoAddress;
  shipping_address?: ZohoAddress;
};

export type ZohoInvoice = {
  invoice_id: string;
  customer_id: string;
  customer_name: string;
  invoice_number: string;
  status: string;       // draft | sent | viewed | overdue | paid | void
  total: number;        // incl. tax
  sub_total?: number;   // excl. tax
  tax_total?: number;
  date: string;         // YYYY-MM-DD
  due_date?: string;
  salesperson_id?: string;
  salesperson_name?: string;
  estimate_id?: string;  // if invoice was created from an estimate
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

export type ZohoEstimate = {
  estimate_id: string;
  estimate_number: string;
  customer_id: string;
  customer_name: string;
  status: string;       // draft | sent | viewed | accepted | declined | invoiced | expired
  total: number;        // incl. tax
  sub_total?: number;   // excl. tax
  tax_total?: number;
  currency_code?: string;
  date: string;
  expiry_date?: string;
  salesperson_id?: string;
  salesperson_name?: string;
  created_time?: string;
  last_modified_time?: string;
};

export type ZohoExpense = {
  expense_id: string;
  date: string;
  account_id?: string;
  account_name?: string;
  paid_through_account_id?: string;
  paid_through_account_name?: string;
  vendor_id?: string;
  vendor_name?: string;
  customer_id?: string;
  customer_name?: string;
  total: number;
  currency_code?: string;
  reference_number?: string;
  description?: string;
  status?: string;
  location?: string;
};

export type IntegrationRow = {
  id: string;
  team_id: string;
  provider: string;
  access_token: string | null;
  refresh_token: string | null;
  expires_at: string | null;
  config: { organization_id?: string; api_domain?: string; region?: string } | null;
  connected_at: string | null;
  last_synced_at: string | null;
  last_sync_error: string | null;
};
