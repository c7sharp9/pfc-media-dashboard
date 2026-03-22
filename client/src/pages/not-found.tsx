import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { Home } from "lucide-react";

export default function NotFound() {
  return (
    <div className="flex items-center justify-center min-h-[60vh] p-4">
      <Card className="p-8 text-center max-w-sm">
        <h1 className="text-4xl font-bold text-primary mb-2">404</h1>
        <h2 className="text-lg font-semibold text-foreground mb-1">Page Not Found</h2>
        <p className="text-sm text-muted-foreground mb-6">
          The page you're looking for doesn't exist.
        </p>
        <Link href="/">
          <Button className="gap-2" data-testid="button-go-home">
            <Home className="w-4 h-4" />
            Back to Sermons
          </Button>
        </Link>
      </Card>
    </div>
  );
}
