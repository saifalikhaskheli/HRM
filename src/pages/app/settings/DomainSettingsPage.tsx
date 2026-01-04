import { DomainSettingsSection } from '@/components/settings/DomainSettingsSection';

export default function DomainSettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Domain Settings</h2>
        <p className="text-muted-foreground">
          Configure your company's subdomain and custom domain settings
        </p>
      </div>
      
      <DomainSettingsSection />
    </div>
  );
}
