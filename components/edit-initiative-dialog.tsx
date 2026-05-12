"use client";

import { useState, useTransition } from "react";
import { Loader2, Plus, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  updateInitiative,
  addOwner,
  removeOwner,
} from "@/app/actions/initiatives";
import type { InitiativeRow, OwnerRow } from "@/lib/db/initiatives";

interface Props {
  initiative: InitiativeRow;
  open: boolean;
  onClose: () => void;
}

export function EditInitiativeDialog({ initiative, open, onClose }: Props) {
  const [title, setTitle] = useState(initiative.title);
  const [description, setDescription] = useState(initiative.description ?? "");
  const [status, setStatus] = useState(initiative.status);
  const [loe, setLoe] = useState(initiative.estimated_loe ?? "__none__");
  const [focus, setFocus] = useState(initiative.high_level_focus ?? "");
  const [newOwnerEmail, setNewOwnerEmail] = useState("");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleSave = () => {
    setSaveError(null);
    startTransition(async () => {
      try {
        await updateInitiative(initiative.id, {
          title: title.trim() || initiative.title,
          description: description.trim() || null,
          status,
          estimated_loe: loe === "__none__" ? null : loe,
          high_level_focus: focus.trim() || null,
        });
        onClose();
      } catch (e) {
        setSaveError(e instanceof Error ? e.message : String(e));
      }
    });
  };

  const handleAddOwner = () => {
    const email = newOwnerEmail.trim();
    if (!email) return;
    startTransition(async () => {
      await addOwner(initiative.id, email);
      setNewOwnerEmail("");
    });
  };

  const handleRemoveOwner = (owner: OwnerRow) => {
    startTransition(async () => {
      await removeOwner(owner.id);
    });
  };

  return (
    <Dialog open={open} onOpenChange={(o: boolean) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit Initiative</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-1">
          {/* Title */}
          <div className="space-y-1.5">
            <Label>Title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>

          {/* Status + LOE */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={status} onValueChange={(v) => { if (v) setStatus(v); }}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="discovery">Discovery</SelectItem>
                  <SelectItem value="planned">Planned</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="complete">Complete</SelectItem>
                  <SelectItem value="paused">Paused</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>LOE</Label>
              <Select value={loe} onValueChange={(v) => { if (v) setLoe(v); }}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">—</SelectItem>
                  <SelectItem value="XS">XS</SelectItem>
                  <SelectItem value="S">S</SelectItem>
                  <SelectItem value="M">M</SelectItem>
                  <SelectItem value="L">L</SelectItem>
                  <SelectItem value="XL">XL</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Focus area */}
          <div className="space-y-1.5">
            <Label>Focus Area</Label>
            <Input
              value={focus}
              onChange={(e) => setFocus(e.target.value)}
              placeholder="e.g. Revenue, Ops Efficiency"
            />
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label>Description</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="Optional description…"
            />
          </div>

          {/* Owners */}
          <div className="space-y-1.5">
            <Label>Owners</Label>
            <div className="flex flex-wrap gap-1.5 min-h-6">
              {initiative.owners.length === 0 && (
                <span className="text-xs text-muted-foreground self-center">
                  No owners assigned
                </span>
              )}
              {initiative.owners.map((o) => (
                <span
                  key={o.id}
                  className="inline-flex items-center gap-1 rounded-full border border-border bg-muted px-2 py-0.5 text-xs"
                >
                  {o.user_email}
                  <button
                    onClick={() => handleRemoveOwner(o)}
                    disabled={isPending}
                    className="opacity-50 hover:opacity-100 disabled:cursor-not-allowed"
                    aria-label={`Remove ${o.user_email}`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <Input
                value={newOwnerEmail}
                onChange={(e) => setNewOwnerEmail(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAddOwner();
                  }
                }}
                placeholder="email@company.com"
                className="h-8 text-sm"
                type="email"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={handleAddOwner}
                disabled={!newOwnerEmail.trim() || isPending}
              >
                <Plus className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          {saveError && (
            <p className="text-xs text-destructive">{saveError}</p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isPending}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isPending || !title.trim()}>
            {isPending && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
            Save changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
