import fs from 'fs/promises';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'data', 'tenant_settings');

export async function getTenantFsSettings(tenantId: string) {
  try {
    const filePath = path.join(DATA_DIR, `${tenantId}.json`);
    const content = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(content);
  } catch (err) {
    return {};
  }
}

export async function updateTenantFsSettings(tenantId: string, payload: any) {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
  } catch (err) {
    // ignore if exists
  }
  
  const filePath = path.join(DATA_DIR, `${tenantId}.json`);
  const current = await getTenantFsSettings(tenantId);
  const updated = { ...current, ...payload };
  await fs.writeFile(filePath, JSON.stringify(updated, null, 2), 'utf-8');
  return updated;
}
