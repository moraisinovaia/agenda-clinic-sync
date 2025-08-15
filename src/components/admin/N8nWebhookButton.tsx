import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Settings, Webhook } from "lucide-react";
import { N8nWebhookMonitor } from "./N8nWebhookMonitor";

export function N8nWebhookButton() {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="flex items-center gap-2">
          <Webhook className="h-4 w-4" />
          Monitor N8N
          <Badge variant="secondary" className="ml-1">
            NOVO
          </Badge>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Monitor N8N Webhook
          </DialogTitle>
        </DialogHeader>
        <div className="overflow-y-auto max-h-[calc(90vh-8rem)]">
          <N8nWebhookMonitor />
        </div>
      </DialogContent>
    </Dialog>
  );
}