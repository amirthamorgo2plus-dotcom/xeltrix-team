import { getMyProfile, getUser } from "@/lib/data";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import { ProfileForm } from "./profile-form";
import { AvatarUploader } from "./avatar-uploader";

export default async function ProfilePage() {
  const user = await getUser();
  const profile = await getMyProfile();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Profile</h1>
        <p className="text-sm text-zinc-500">{user?.email}</p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Avatar</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-3">
            <Avatar src={profile?.avatar_url} name={profile?.full_name} size={96} />
            <AvatarUploader currentUrl={profile?.avatar_url ?? null} />
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Details</CardTitle>
          </CardHeader>
          <CardContent>
            <ProfileForm
              defaultName={profile?.full_name ?? ""}
              defaultPhone={profile?.phone ?? ""}
              defaultTimezone={profile?.timezone ?? "Asia/Kolkata"}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
