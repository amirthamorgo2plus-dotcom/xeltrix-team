import { getMyMembership, getTeamSettings, isAdminOrManager } from "@/lib/data";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/empty-state";
import { QrUploader } from "./qr-uploader";

export default async function PaymentQrPage() {
  const me = await getMyMembership();
  const settings = await getTeamSettings();
  const canManage = isAdminOrManager(me?.role);
  const qrUrl = settings?.payment_qr_url ?? null;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Payment QR</h1>
        <p className="text-sm text-zinc-500">
          Show this to the customer — they scan it with any UPI app (GPay,
          PhonePe, Paytm) to pay.
        </p>
      </div>

      <Card>
        <CardContent className="flex flex-col items-center gap-5 py-8">
          {qrUrl ? (
            <>
              {/* Large, high-contrast so it scans easily from a phone screen. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={qrUrl}
                alt="Payment QR code"
                className="h-auto w-full max-w-xs rounded-lg border border-zinc-200 bg-white p-3 shadow-sm dark:border-zinc-700"
              />
              <p className="text-center text-sm text-zinc-500">
                Hold the screen steady and let the customer scan.
              </p>
            </>
          ) : (
            <EmptyState
              title="No payment QR set yet"
              hint={
                canManage
                  ? "Upload your company UPI QR below."
                  : "Ask an admin to upload the company payment QR."
              }
            />
          )}

          {canManage && (
            <div className="w-full border-t border-zinc-200 pt-4 dark:border-zinc-800">
              <QrUploader hasQr={!!qrUrl} />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
