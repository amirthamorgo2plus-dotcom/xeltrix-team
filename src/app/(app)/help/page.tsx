import { HelpContent } from "./help-content";

export default function HelpPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Help &amp; Onboarding</h1>
        <p className="text-sm text-zinc-500">
          A short walkthrough of the everyday tools. / தினசரி கருவிகளின் சுருக்கமான வழிகாட்டி.
        </p>
      </div>
      <HelpContent />
    </div>
  );
}
