import { Trophy } from "lucide-react";
import { getMyMembership, getTeamSettings, isAdminOrManager } from "@/lib/data";
import { Card } from "@/components/ui/card";
import { EotmCard } from "@/components/eotm-card";
import { EotmUploader } from "@/components/eotm-uploader";

// Dashboard Employee of the Month block: shows the admin-uploaded image as a
// card (with lightbox); admins also get an inline upload/replace/remove
// control. Renders nothing for non-admins when no image is set.
export async function EmployeeOfTheMonth() {
  const membership = await getMyMembership();
  const isAdmin = isAdminOrManager(membership?.role);
  const settings = await getTeamSettings();
  const url = settings?.eotm_url ?? null;
  const caption = settings?.eotm_caption ?? null;

  if (!url && !isAdmin) return null;

  return (
    <div className="flex flex-col gap-2">
      {url ? (
        <EotmCard imageUrl={url} caption={caption} />
      ) : (
        <Card className="flex items-center gap-3 border-dashed border-amber-300/60 bg-amber-50/40 p-5 text-sm text-zinc-500 dark:border-amber-900/40 dark:bg-amber-950/20">
          <Trophy className="h-5 w-5 text-amber-500" aria-hidden />
          <span>No Rewards yet — upload an image below.</span>
        </Card>
      )}
      {isAdmin && <EotmUploader hasImage={!!url} currentCaption={caption} />}
    </div>
  );
}
