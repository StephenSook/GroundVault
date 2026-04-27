import { ExternalLink, MapPin } from "lucide-react";

// 960 Lawton St SW, Atlanta, GA 30310 — the Trust at Oakland City
// anchor property the demo runs against. Lat/lon resolved from
// OpenStreetMap's geocoder. Bounding box centered ~0.01 degrees on
// each side gives a tight neighborhood-scale view.
const LAT = 33.7330;
const LON = -84.4231;
const BBOX_DELTA = 0.005;

const ADDRESS = "960 Lawton St SW";
const NEIGHBORHOOD = "Oakland City";
const CITY = "Atlanta, GA 30310";

const OSM_EMBED = `https://www.openstreetmap.org/export/embed.html?bbox=${LON - BBOX_DELTA}%2C${LAT - BBOX_DELTA}%2C${LON + BBOX_DELTA}%2C${LAT + BBOX_DELTA}&layer=mapnik&marker=${LAT}%2C${LON}`;
const OSM_VIEW = `https://www.openstreetmap.org/?mlat=${LAT}&mlon=${LON}&zoom=16`;
const GOOGLE_MAPS_VIEW = `https://www.google.com/maps/search/?api=1&query=${LAT},${LON}`;

export function PropertyMap() {
  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      <div className="flex items-start justify-between gap-4 px-6 py-4">
        <div>
          <div className="flex items-center gap-2 text-forest">
            <MapPin className="h-4 w-4" />
            <h3 className="font-display text-xl">{ADDRESS}</h3>
          </div>
          <div className="text-xs text-muted-foreground mt-0.5">
            {NEIGHBORHOOD} · {CITY}
          </div>
          <div className="text-[11px] text-muted-foreground mt-2 max-w-md">
            Real property, real address, real Community Land Trust covenant. The
            confidentiality stack on chain protects funding for THIS house from
            speculator front-running.
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <a
            href={OSM_VIEW}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-muted-foreground hover:text-forest transition-colors"
          >
            OSM <ExternalLink className="h-3 w-3" />
          </a>
          <span className="text-muted-foreground/40">·</span>
          <a
            href={GOOGLE_MAPS_VIEW}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-muted-foreground hover:text-forest transition-colors"
          >
            Google Maps <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      </div>
      <div className="h-72 w-full bg-muted">
        <iframe
          title={`Map of ${ADDRESS}`}
          src={OSM_EMBED}
          className="h-full w-full"
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
        />
      </div>
    </div>
  );
}
