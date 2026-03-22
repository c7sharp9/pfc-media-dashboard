import { Switch, Route, Router } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import AppLayout from "@/components/AppLayout";
import SermonsList from "@/pages/sermons-list";
import SermonDetail from "@/pages/sermon-detail";
import EditsPage from "@/pages/edits";
import WorkflowPage from "@/pages/workflow";
import NotFound from "@/pages/not-found";
import { useEffect } from "react";

function ThemeInit() {
  useEffect(() => {
    // Default to dark mode
    document.documentElement.classList.add("dark");
  }, []);
  return null;
}

function AppRouter() {
  return (
    <AppLayout>
      <Switch>
        <Route path="/" component={SermonsList} />
        <Route path="/edits" component={EditsPage} />
        <Route path="/workflow" component={WorkflowPage} />
        <Route path="/sermon/:id" component={SermonDetail} />
        <Route component={NotFound} />
      </Switch>
    </AppLayout>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <ThemeInit />
        <Toaster />
        <Router hook={useHashLocation}>
          <AppRouter />
        </Router>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
