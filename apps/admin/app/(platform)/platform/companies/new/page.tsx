import { Building2 } from "lucide-react";
import { Card, CardBody, CardHeader, PageHeader } from "@/components/ui";
import { requireSuperadmin } from "@/lib/platform";
import { CreateCompanyForm } from "./create-company-form";

export default async function NewCompanyPage() {
  await requireSuperadmin();

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Building2}
        title="New company"
        description="Creates the shop account and the first admin login."
      />
      <Card>
        <CardHeader title="Company and first admin" />
        <CardBody>
          <CreateCompanyForm />
        </CardBody>
      </Card>
    </div>
  );
}
