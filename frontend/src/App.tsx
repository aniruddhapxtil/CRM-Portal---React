import { Navigate, Route, Routes } from "react-router-dom";
import { HomePage } from "./features/dashboard/HomePage";
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
import { UsersRegistryPage } from "./features/admin/UsersRegistryPage";
import { UserFormPage } from "./features/admin/UserFormPage";
import { QualificationsPendingPage } from "./features/qualifications/QualificationsPendingPage";
import { RequireAdmin } from "./components/layout/RequireAdmin";
import { RequireRole } from "./components/layout/RequireRole";

export default function App() {
  return (
    <Routes>
      <Route
        path="/"
        element={
          <RequireRole allowed={["Admin", "Team Lead", "Executive"]}>
            <HomePage />
          </RequireRole>
        }
      />
      <Route path="/voice" element={<VoiceStationPage />} />

      <Route path="/accounts">
        <Route index element={<AccountsRegistryPage />} />
        <Route
          path="new"
          element={
            <RequireRole allowed={["Admin", "Team Lead", "Sales Representative"]}>
              <AccountFormPage />
            </RequireRole>
          }
        />
        <Route path=":id/edit" element={<AccountFormPage />} />
      </Route>

      <Route path="/subsidiaries">
        <Route index element={<SubsidiariesRegistryPage />} />
        <Route
          path="new"
          element={
            <RequireRole allowed={["Admin", "Team Lead", "Sales Representative"]}>
              <SubsidiaryFormPage />
            </RequireRole>
          }
        />
        <Route path=":id/edit" element={<SubsidiaryFormPage />} />
      </Route>

      <Route path="/contacts">
        <Route index element={<ContactsRegistryPage />} />
        <Route
          path="new"
          element={
            <RequireRole allowed={["Admin", "Team Lead", "Sales Representative"]}>
              <ContactFormPage />
            </RequireRole>
          }
        />
        <Route path=":id/edit" element={<ContactFormPage />} />
      </Route>

      <Route path="/leads">
        <Route index element={<LeadRegistryPage />} />
        <Route
          path="new"
          element={
            <RequireRole allowed={["Admin", "Team Lead", "Sales Representative"]}>
              <LeadFormPage />
            </RequireRole>
          }
        />
        <Route path=":id/edit" element={<LeadFormPage />} />
      </Route>

      <Route path="/opportunities">
        <Route index element={<OpportunityRegistryPage />} />
        <Route
          path="new"
          element={
            <RequireRole allowed={["Admin", "Team Lead"]}>
              <OpportunityFormPage />
            </RequireRole>
          }
        />
        <Route path=":id/edit" element={<OpportunityFormPage />} />
      </Route>

      <Route path="/projects">
        <Route index element={<ProjectsRegistryPage />} />
        <Route
          path="new"
          element={
            <RequireRole allowed={["Admin"]}>
              <ProjectFormPage />
            </RequireRole>
          }
        />
        <Route path=":id/edit" element={<ProjectFormPage />} />
      </Route>

      <Route path="/activities">
        <Route index element={<ActivitiesRegistryPage />} />
        <Route
          path="new"
          element={
            <RequireRole allowed={["Admin", "Team Lead", "Sales Representative"]}>
              <ActivityFormPage />
            </RequireRole>
          }
        />
        <Route path=":id/edit" element={<ActivityFormPage />} />
      </Route>

      <Route path="/admin/users">
        <Route index element={<RequireAdmin><UsersRegistryPage /></RequireAdmin>} />
        <Route path="new" element={<RequireAdmin><UserFormPage /></RequireAdmin>} />
        <Route path=":id/edit" element={<RequireAdmin><UserFormPage /></RequireAdmin>} />
      </Route>

      <Route
        path="/qualifications"
        element={
          <RequireRole allowed={["Admin", "Team Lead", "Executive"]}>
            <QualificationsPendingPage />
          </RequireRole>
        }
      />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
