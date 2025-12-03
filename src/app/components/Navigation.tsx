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
      title: "Relationships",
      subtitle: "",
      segments: [
        "Contacts",
        "Organisations",
        "Documents",
      ],
    },
    {
      title: "Strategy",
      subtitle: "",
      segments: [
        "Tools",
      ],
    },
    {
      title: "Projects",
      subtitle: "",
      segments: [
        "Projects Internal",
        "Projects MB 2.0",
      ],
    },
  ];

  return (
    <aside className="w-full border-r border-neutral-800 p-4 text-sm bg-neutral-900">
      <div className="space-y-6">
        {dimensions.map((dimension) => (
          <div key={dimension.title}>
            <h3 className="font-semibold mb-1 text-white">{dimension.title}</h3>
            <ul className="space-y-1">
              {dimension.segments.map((segment) => {
                const isSelected =
                  selectedDimension === dimension.title &&
                  selectedSegment === segment;
                return (
                  <li key={segment}>
                    <button
                      onClick={() => handleSegmentClick(dimension.title, segment)}
                      className={`text-left w-full py-1 px-2 -mx-2 rounded transition-colors ${
                        isSelected
                          ? "bg-neutral-700 text-white"
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

