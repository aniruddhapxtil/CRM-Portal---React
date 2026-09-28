import { Navigate, Route, Routes } from "react-router-dom";
import { AccountFormPage } from "./features/accounts/AccountFormPage";
import { AccountsRegistryPage } from "./features/accounts/AccountsRegistryPage";
import { SubsidiaryFormPage } from "./features/subsidiaries/SubsidiaryFormPage";
import { SubsidiariesRegistryPage } from "./features/subsidiaries/SubsidiariesRegistryPage";
import { ContactFormPage } from "./features/contacts/ContactFormPage";
import { ContactsRegistryPage } from "./features/contacts/ContactsRegistryPage";
import { LeadFormPage } from "./features/leads/LeadFormPage";
import { LeadRegistryPage } from "./features/leads/LeadRegistryPage";
import { OpportunityFormPage } from "./features/opportunities/OpportunityFormPage";
import { OpportunityRegistryPage } from "./features/opportunities/OpportunityRegistryPage";
import { ProjectFormPage } from "./features/projects/ProjectFormPage";
import { ProjectsRegistryPage } from "./features/projects/ProjectsRegistryPage";
import { ActivityFormPage } from "./features/activities/ActivityFormPage";
import { ActivitiesRegistryPage } from "./features/activities/ActivitiesRegistryPage";
import { VoiceStationPage } from "./features/voice/VoiceStationPage";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/voice" replace />} />
      <Route path="/voice" element={<VoiceStationPage />} />

      <Route path="/accounts">
        <Route index element={<AccountsRegistryPage />} />
        <Route path="new" element={<AccountFormPage />} />
        <Route path=":id/edit" element={<AccountFormPage />} />
      </Route>

      <Route path="/subsidiaries">
        <Route index element={<SubsidiariesRegistryPage />} />
        <Route path="new" element={<SubsidiaryFormPage />} />
        <Route path=":id/edit" element={<SubsidiaryFormPage />} />
      </Route>

      <Route path="/contacts">
        <Route index element={<ContactsRegistryPage />} />
        <Route path="new" element={<ContactFormPage />} />
        <Route path=":id/edit" element={<ContactFormPage />} />
      </Route>

      <Route path="/leads">
        <Route index element={<LeadRegistryPage />} />
        <Route path="new" element={<LeadFormPage />} />
        <Route path=":id/edit" element={<LeadFormPage />} />
      </Route>

      <Route path="/opportunities">
        <Route index element={<OpportunityRegistryPage />} />
        <Route path="new" element={<OpportunityFormPage />} />
        <Route path=":id/edit" element={<OpportunityFormPage />} />
      </Route>

      <Route path="/projects">
        <Route index element={<ProjectsRegistryPage />} />
        <Route path="new" element={<ProjectFormPage />} />
        <Route path=":id/edit" element={<ProjectFormPage />} />
      </Route>

      <Route path="/activities">
        <Route index element={<ActivitiesRegistryPage />} />
        <Route path="new" element={<ActivityFormPage />} />
        <Route path=":id/edit" element={<ActivityFormPage />} />
      </Route>

      <Route path="*" element={<Navigate to="/voice" replace />} />
    </Routes>
  );
}
