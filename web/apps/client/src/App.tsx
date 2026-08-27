import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { LanguageProvider } from "@/i18n/LanguageContext";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HashRouter, Routes, Route } from "react-router-dom";
import { Protected } from "./components/FieldworkShell";
import LoginPage from "./pages/LoginPage";
import TeacherLoginPage from "./pages/TeacherLoginPage";
import ZoneMapPage from "./pages/ZoneMapPage";
import ZoneDetailPage from "./pages/ZoneDetailPage";
import TaskRouter from "./pages/forms/TaskForms";
import TeacherDashboard from "./pages/TeacherDashboard";
import CollectedDataPage from "./pages/CollectedDataPage";
import NotFound from "./pages/not-found/Index";

const queryClient = new QueryClient();
const App = () => <QueryClientProvider client={queryClient}><TooltipProvider><LanguageProvider><Sonner /><HashRouter><Routes><Route path="/" element={<LoginPage />} /><Route path="/teacher-login" element={<TeacherLoginPage />} /><Route path="/map" element={<Protected role="student"><ZoneMapPage /></Protected>} /><Route path="/data" element={<Protected role="student"><CollectedDataPage /></Protected>} /><Route path="/zone/:zoneId" element={<Protected role="student"><ZoneDetailPage /></Protected>} /><Route path="/zone/:zoneId/task/:taskId" element={<Protected role="student"><TaskRouter /></Protected>} /><Route path="/teacher" element={<Protected role="teacher"><TeacherDashboard /></Protected>} /><Route path="*" element={<NotFound />} /></Routes></HashRouter></LanguageProvider></TooltipProvider></QueryClientProvider>;
export default App;
