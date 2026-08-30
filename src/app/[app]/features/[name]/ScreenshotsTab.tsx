"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Upload, X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Lightbox, type LightboxItem } from "@/components/shared/Lightbox";

// Fully self-contained: owns upload/delete/lightbox state so the tab can be
// dropped in with a single prop set. The delete-confirm dialog and lightbox
// are modals, so their unmount when this tab is inactive is unobservable.
export function ScreenshotsTab({
  app,
  name,
  screenshots,
  onChanged,
}: {
  app: string;
  name: string;
  screenshots: string[];
  onChanged: () => Promise<void>;
}) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const uploadScreenshots = async (files: FileList) => {
    const formData = new FormData();
    for (let i = 0; i < files.length; i++)
      formData.append("screenshots", files[i]);
    await fetch(`/api/${app}/features/${name}/screenshots`, {
      method: "POST",
      body: formData,
    });
    await onChanged();
    toast.success(`${files.length} screenshot(s) uploaded!`);
  };

  const deleteScreenshot = async () => {
    if (!confirmDelete) return;
    setDeleting(true);
    await fetch(`/api/${app}/features/${name}/screenshots`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fileName: confirmDelete }),
    });
    await onChanged();
    setDeleting(false);
    setConfirmDelete(null);
    toast.success("Screenshot deleted");
  };

  const screenshotItems: LightboxItem[] = screenshots.map((f) => ({
    src: `/api/${app}/features/${name}/screenshots/${f}`,
    name: f,
    isVideo: false,
  }));

  return (
    <>
      <Card>
        <CardHeader className="flex-row flex-wrap items-center justify-between gap-y-2 pb-3">
          <CardTitle className="text-base">Screenshots</CardTitle>
          <label className="cursor-pointer inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors">
            <Upload className="h-3.5 w-3.5" /> Upload
            <input
              type="file"
              multiple
              accept="image/*"
              className="hidden"
              onChange={(e) =>
                e.target.files && uploadScreenshots(e.target.files)
              }
            />
          </label>
        </CardHeader>
        <CardContent>
          {screenshots.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-2">
              <span className="text-3xl">📷</span>
              <p className="text-sm">No screenshots uploaded yet</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {screenshots.map((file, i) => (
                <div
                  key={file}
                  className="relative group rounded-lg overflow-hidden border bg-muted aspect-[9/16]"
                >
                  <img
                    src={`/api/${app}/features/${name}/screenshots/${file}`}
                    alt={file}
                    className="w-full h-full object-cover cursor-pointer"
                    onClick={() => setLightboxIndex(i)}
                  />
                  <div className="absolute inset-0 bg-black/25 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
                  <button
                    onClick={(e) => { e.stopPropagation(); setConfirmDelete(file); }}
                    className="absolute top-1.5 right-1.5 p-1.5 rounded-full bg-black/50 text-white opacity-0 group-hover:opacity-100 hover:bg-red-500/80 transition-opacity"
                    aria-label="Delete screenshot"
                  >
                    <X className="h-4 w-4" />
                  </button>
                  <p className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-[10px] px-2 py-1 truncate">
                    {file}
                  </p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!confirmDelete} onOpenChange={(open) => !open && setConfirmDelete(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Screenshot</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete{" "}
              <span className="font-medium text-foreground">{confirmDelete}</span>?{" "}
              This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setConfirmDelete(null)} disabled={deleting}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={deleteScreenshot} disabled={deleting}>
              {deleting ? "Deleting…" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Screenshot lightbox (shared component) */}
      <Lightbox
        items={screenshotItems}
        index={lightboxIndex}
        onClose={() => setLightboxIndex(null)}
        onIndexChange={setLightboxIndex}
      />
    </>
  );
}
