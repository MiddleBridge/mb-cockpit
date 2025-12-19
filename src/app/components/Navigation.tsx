"use client";

import { useRouter, useSearchParams } from "next/navigation";

export default function Navigation() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const handleSegmentClick = (dimension: string, segment: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("dimension", dimension);
    params.set("segment", segment);
    router.push(`?${params.toString()}`);
  };

  const selectedDimension = searchParams.get("dimension");
  const selectedSegment = searchParams.get("segment");

  const dimensions = [
    {
      title: "Relationships & Network",
      subtitle: "WHO",
      segments: [
        "Contacts",
        "Organisations",
        "Documents",
        "E-mails",
      ],
    },
    {
      title: "Knowledge",
      subtitle: "",
      segments: [
        "Law",
        "Communication",
      ],
    },
    {
      title: "Projects",
      subtitle: "",
      segments: [
        "Projects",
        "Nauka chińskiego",
      ],
    },
    {
      title: "Finance",
      subtitle: "",
      segments: [
        "Transactions",
        "Trips",
      ],
    },
  ];

  return (
    <aside className="w-full h-full border-r border-neutral-800 p-4 text-sm bg-neutral-900 overflow-y-auto">
      <div className="space-y-8">
        {dimensions.map((dimension) => (
          <div key={dimension.title}>
            <h3 className="font-semibold mb-2 text-white text-base">{dimension.title}</h3>
            {dimension.subtitle && (
              <p className="text-xs text-neutral-400 mb-3">{dimension.subtitle}</p>
            )}
            <ul className="space-y-1.5">
              {dimension.segments.map((segment) => {
                const isSelected =
                  selectedDimension === dimension.title &&
                  selectedSegment === segment;
                return (
                  <li key={segment}>
                    <button
                      onClick={() => handleSegmentClick(dimension.title, segment)}
                      className={`text-left w-full py-2 px-3 rounded transition-colors ${
                        isSelected
                          ? "bg-neutral-700 text-white font-medium"
                          : "text-neutral-300 hover:text-white hover:bg-neutral-800"
                      }`}
                    >
                      {segment}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </aside>
  );
}

