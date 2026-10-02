declare module 'esri-leaflet' {
  import type * as L from 'leaflet';
  export function dynamicMapLayer(o: { url: string; opacity?: number; layers?: number[]; format?: string; transparent?: boolean; minZoom?: number; maxZoom?: number; f?: string; attribution?: string }): L.Layer;
  export function featureLayer(o: { url: string; minZoom?: number; simplifyFactor?: number; style?: () => L.PathOptions; fields?: string[]; attribution?: string }): L.Layer;
}
