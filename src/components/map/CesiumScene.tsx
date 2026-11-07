import { useEffect, useRef } from 'react';
import * as Cesium from 'cesium';
import 'cesium/Build/Cesium/Widgets/widgets.css';
import { useVoyageStore } from '@/stores/voyageStore';
import { useSimulationStore } from '@/stores/simulationStore';
import { useMapStore } from '@/stores/mapStore';
import { PORTS } from '@/data/ports';
import { VESSEL_MODELS } from '@/data/vesselModels';
import { activeStormCenterAt, getEnvironmentAt } from '@/engine/environment';
import { arrowIconDataUri, portIconDataUri, shipIconDataUri } from '@/engine/canvasIcons';
import { riskTone } from '@/components/ui/statusTones';
import type { Route } from '@/types';


const RISK_DOT_COLOR: Record<string, string> = {
  ok: '#33cc7a',
  info: '#3aa0ff',
  warn: '#f2b53d',
  crit: '#ff4d4f',
  neutral: '#7a95ac',
};

function toCartesian(lat: number, lon: number, height = 0) {
  return Cesium.Cartesian3.fromDegrees(lon, lat, height);
}

export default function CesiumScene({ onFailure }: { onFailure: () => void }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<Cesium.Viewer | null>(null);

  const routeEntitiesRef = useRef<Cesium.Entity[]>([]);
  const hazardEntitiesRef = useRef<Cesium.Entity[]>([]);
  const glyphEntitiesRef = useRef<Cesium.Entity[]>([]);
  const vesselEntityRef = useRef<Cesium.Entity | null>(null);
  const shipStateRef = useRef({ lat: 0, lon: 0, heading: 0 });

  const routes = useVoyageStore((s) => s.routes);
  const activeRouteId = useVoyageStore((s) => s.activeRouteId);
  const status = useVoyageStore((s) => s.status);
  const vessel = useVoyageStore((s) => s.vessel);

  const routeVersions = useSimulationStore((s) => s.routeVersions);
  const activeVersionIndex = useSimulationStore((s) => s.activeVersionIndex);
  const activeStorms = useSimulationStore((s) => s.activeStorms);
  const activeSecurityZones = useSimulationStore((s) => s.activeSecurityZones);

  const layers = useMapStore((s) => s.layers);
  const cameraMode = useMapStore((s) => s.cameraMode);
  const focusRequest = useMapStore((s) => s.focusRequest);

  // --- viewer lifecycle -----------------------------------------------
  useEffect(() => {
    if (!containerRef.current) return;

    const viewer = new Cesium.Viewer(containerRef.current, {
      baseLayer: Cesium.ImageryLayer.fromProviderAsync(
        Cesium.TileMapServiceImageryProvider.fromUrl(
          Cesium.buildModuleUrl('Assets/Textures/NaturalEarthII'),
          { credit: 'Natural Earth II · local low-resolution imagery' },
        ),
      ),
      terrainProvider: new Cesium.EllipsoidTerrainProvider(),
      baseLayerPicker: false,
      geocoder: false,
      homeButton: false,
      sceneModePicker: false,
      navigationHelpButton: false,
      animation: false,
      timeline: false,
      fullscreenButton: false,
      infoBox: false,
      selectionIndicator: false,
      showRenderLoopErrors: false,
      shouldAnimate: true,
    });

    viewer.scene.globe.baseColor = Cesium.Color.fromCssColorString('#050c14');
    if (viewer.scene.skyAtmosphere) {
      viewer.scene.skyAtmosphere.hueShift = -0.03;
      viewer.scene.skyAtmosphere.saturationShift = -0.55;
      viewer.scene.skyAtmosphere.brightnessShift = -0.3;
    }
    viewer.scene.fog.enabled = true;
    viewer.scene.globe.enableLighting = false;
    viewer.scene.backgroundColor = Cesium.Color.fromCssColorString('#05080d');
    viewer.clock.shouldAnimate = false;

    // MARLIN's operating theatre is the Indian Ocean corridor — keep the
    // camera framed there by default and cap how far out the operator can
    // zoom, rather than defaulting to (or allowing) a whole-Earth view.
    viewer.scene.screenSpaceCameraController.minimumZoomDistance = 2_000;
    viewer.scene.screenSpaceCameraController.maximumZoomDistance = 11_000_000;
    viewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(70, -2, 8_500_000),
      duration: 0,
    });

    viewerRef.current = viewer;
    const removeRenderError = viewer.scene.renderError.addEventListener(onFailure);
    viewer.targetFrameRate = 30;

    return () => {
      removeRenderError();
      viewer.destroy();
      viewerRef.current = null;
    };
  }, [onFailure]);

  // --- ports (static) ---------------------------------------------------
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || viewer.isDestroyed()) return;
    const icon = portIconDataUri();
    const entities = PORTS.map((p) =>
      viewer.entities.add({
        position: toCartesian(p.lat, p.lon),
        billboard: { image: icon, scale: 0.8, verticalOrigin: Cesium.VerticalOrigin.CENTER },
        label: {
          text: p.name,
          font: '11px Inter, sans-serif',
          fillColor: Cesium.Color.fromCssColorString('#7a95ac'),
          pixelOffset: new Cesium.Cartesian2(10, 0),
          horizontalOrigin: Cesium.HorizontalOrigin.LEFT,
          showBackground: false,
          scaleByDistance: new Cesium.NearFarScalar(1.5e6, 1, 1.2e7, 0),
        },
      }),
    );
    return () => {
      if (viewer.isDestroyed()) return;
      entities.forEach((e) => viewer.entities.remove(e));
    };
  }, []);

  // --- candidate routes (planning / analysis views) ---------------------
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || viewer.isDestroyed()) return;

    routeEntitiesRef.current.forEach((e) => viewer.entities.remove(e));
    routeEntitiesRef.current = [];

    const displayRoutes: Route[] = routes ?? (routeVersions[activeVersionIndex] ? [routeVersions[activeVersionIndex].route] : []);
    if (!layers.route) return;

    for (const route of displayRoutes) {
      const isActive = route.id === activeRouteId || displayRoutes.length === 1;
      const positions = route.waypoints.map((w) => toCartesian(w.lat, w.lon, 3000));
      const entity = viewer.entities.add({
        polyline: {
          positions,
          width: isActive ? 4.5 : 2,
          material: isActive
            ? Cesium.Color.fromCssColorString(route.color)
            : Cesium.Color.fromCssColorString(route.color).withAlpha(0.35),
          clampToGround: false,
        },
      });
      routeEntitiesRef.current.push(entity);

      if (layers.risk) {
        const step = Math.max(1, Math.floor(route.waypoints.length / 18));
        for (let i = 0; i < route.waypoints.length; i += step) {
          const w = route.waypoints[i];
          const tone = riskTone(w.riskAtPoint);
          const dot = viewer.entities.add({
            position: toCartesian(w.lat, w.lon, 3000),
            point: {
              pixelSize: isActive ? 6 : 4,
              color: Cesium.Color.fromCssColorString(RISK_DOT_COLOR[tone]).withAlpha(isActive ? 0.9 : 0.4),
              outlineColor: Cesium.Color.fromCssColorString('#05080d'),
              outlineWidth: 1,
            },
          });
          routeEntitiesRef.current.push(dot);
        }
      }
    }

    if (displayRoutes.length && cameraMode === 'global') {
      const all = displayRoutes.flatMap((r) => r.waypoints.map((w) => toCartesian(w.lat, w.lon)));
      const sphere = Cesium.BoundingSphere.fromPoints(all);
      viewer.camera.flyToBoundingSphere(sphere, { duration: 0.001, offset: new Cesium.HeadingPitchRange(0, Cesium.Math.toRadians(-55), sphere.radius * 2.4) });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routes, activeRouteId, routeVersions, activeVersionIndex, layers.route, layers.risk]);

  // --- environment glyphs (sampled along the active route) --------------
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || viewer.isDestroyed()) return;

    glyphEntitiesRef.current.forEach((e) => viewer.entities.remove(e));
    glyphEntitiesRef.current = [];

    const activeRoute = routes?.find((r) => r.id === activeRouteId) ?? routeVersions[activeVersionIndex]?.route;
    if (!activeRoute) return;
    if (!layers.wind && !layers.waves && !layers.current) return;

    const step = Math.max(1, Math.floor(activeRoute.waypoints.length / 14));
    for (let i = step; i < activeRoute.waypoints.length - 1; i += step) {
      const w = activeRoute.waypoints[i];
      const env = getEnvironmentAt(w.lat, w.lon, w.etaMs, activeStorms);

      if (layers.wind) {
        const e = viewer.entities.add({
          position: toCartesian(w.lat, w.lon, 5000),
          billboard: {
            image: arrowIconDataUri('#33d6e0'),
            scale: 0.5 + Math.min(0.6, env.windSpeedKn / 60),
            rotation: Cesium.Math.toRadians(-env.windDirDeg),
            alignedAxis: Cesium.Cartesian3.UNIT_Z,
          },
        });
        glyphEntitiesRef.current.push(e);
      }
      if (layers.current) {
        const e = viewer.entities.add({
          position: toCartesian(w.lat, w.lon, 5000),
          billboard: {
            image: arrowIconDataUri('#3aa0ff'),
            scale: 0.35 + Math.min(0.4, env.currentSpeedKn / 4),
            rotation: Cesium.Math.toRadians(-env.currentDirDeg),
            alignedAxis: Cesium.Cartesian3.UNIT_Z,
            pixelOffset: new Cesium.Cartesian2(14, 0),
          },
        });
        glyphEntitiesRef.current.push(e);
      }
      if (layers.waves) {
        const e = viewer.entities.add({
          position: toCartesian(w.lat, w.lon, 1000),
          ellipse: {
            semiMinorAxis: 15000 + env.waveHeightM * 12000,
            semiMajorAxis: 15000 + env.waveHeightM * 12000,
            material: Cesium.Color.fromCssColorString('#3aa0ff').withAlpha(0.12),
            outline: false,
          },
        });
        glyphEntitiesRef.current.push(e);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routes, activeRouteId, routeVersions, activeVersionIndex, layers.wind, layers.waves, layers.current, activeStorms]);

  // --- hazards: storms + security zones ---------------------------------
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || viewer.isDestroyed()) return;

    hazardEntitiesRef.current.forEach((e) => viewer.entities.remove(e));
    hazardEntitiesRef.current = [];

    if (layers.storm) {
      for (const storm of activeStorms) {
        const center = activeStormCenterAt(storm, useSimulationStore.getState().simTimeMs);
        const e = viewer.entities.add({
          position: toCartesian(center.lat, center.lon, 500),
          ellipse: {
            semiMinorAxis: storm.radiusKm * 1000,
            semiMajorAxis: storm.radiusKm * 1000,
            material: Cesium.Color.fromCssColorString('#ff4d4f').withAlpha(0.16),
            outline: true,
            outlineColor: Cesium.Color.fromCssColorString('#ff4d4f').withAlpha(0.6),
          },
          label: {
            text: 'SIMULATED STORM',
            font: 'bold 10px Inter, sans-serif',
            fillColor: Cesium.Color.fromCssColorString('#ff4d4f'),
            pixelOffset: new Cesium.Cartesian2(0, -18),
          },
        });
        hazardEntitiesRef.current.push(e);
      }
    }

    if (layers.security) {
      for (const zone of activeSecurityZones) {
        const color = zone.level === 'CRITICAL' ? '#ff4d4f' : zone.level === 'HIGH' ? '#f2b53d' : '#3aa0ff';
        const e = viewer.entities.add({
          position: toCartesian(zone.center.lat, zone.center.lon, 500),
          ellipse: {
            semiMinorAxis: zone.radiusKm * 1000,
            semiMajorAxis: zone.radiusKm * 1000,
            material: Cesium.Color.fromCssColorString(color).withAlpha(0.14),
            outline: true,
            outlineColor: Cesium.Color.fromCssColorString(color).withAlpha(0.7),
          },
          label: {
            text: `SIMULATED SECURITY SCENARIO — ${zone.level}`,
            font: 'bold 10px Inter, sans-serif',
            fillColor: Cesium.Color.fromCssColorString(color),
            pixelOffset: new Cesium.Cartesian2(0, -18),
          },
        });
        hazardEntitiesRef.current.push(e);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeStorms, activeSecurityZones, layers.storm, layers.security]);

  // --- vessel -------------------------------------------------------------
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || viewer.isDestroyed()) return;

    if (status !== 'underway' && status !== 'complete') {
      if (vesselEntityRef.current) {
        viewer.entities.remove(vesselEntityRef.current);
        vesselEntityRef.current = null;
      }
      return;
    }
    if (vesselEntityRef.current) return;
    if (!layers.vessel) return;

    const positionProperty = new Cesium.CallbackPositionProperty(
      () => toCartesian(shipStateRef.current.lat, shipStateRef.current.lon, 12000),
      false,
    );
    const model = VESSEL_MODELS[vessel.type];

    const entity = viewer.entities.add({
      position: positionProperty,
      // Real GLB hull. minimumPixelSize keeps it visible when zoomed far out.
      model: {
        uri: model.path,
        scale: model.scale,
        minimumPixelSize: 26,
        maximumScale: 4000,
      },
      // Compact top-down ship symbol, shown only while the GLB is unavailable
      // (still loading, or 404/decode failure). Cesium keeps both graphics on
      // the entity, so this is toggled off once the model reports ready —
      // giving a legible fallback instead of an empty patch of ocean.
      billboard: {
        image: shipIconDataUri('#dce6ee'),
        scale: 0.5,
        rotation: new Cesium.CallbackProperty(
          () => Cesium.Math.toRadians(-shipStateRef.current.heading),
          false,
        ),
        alignedAxis: Cesium.Cartesian3.UNIT_Z,
        show: true,
      },
      orientation: new Cesium.CallbackProperty((_time, result) => {
        const position = toCartesian(shipStateRef.current.lat, shipStateRef.current.lon, 12000);
        const hpr = new Cesium.HeadingPitchRoll(
          Cesium.Math.toRadians(shipStateRef.current.heading + model.headingOffsetDeg),
          0,
          0,
        );
        return Cesium.Transforms.headingPitchRollQuaternion(position, hpr, undefined, undefined, result);
      }, false),
      label: {
        text: vessel.name,
        font: 'bold 11px Inter, sans-serif',
        fillColor: Cesium.Color.fromCssColorString('#dce6ee'),
        pixelOffset: new Cesium.Cartesian2(0, 26),
      },
    });
    vesselEntityRef.current = entity;

    // Swap the fallback symbol out as soon as the GLB is actually renderable.
    // Cesium exposes readiness per primitive rather than as a promise on the
    // entity, so this polls the scene briefly instead of assuming success — if
    // the model 404s or fails to decode, the billboard simply stays up.
    let settled = false;
    const stopWatching = viewer.scene.postRender.addEventListener(() => {
      if (settled || viewer.isDestroyed()) return;
      const primitive = (
        viewer.dataSourceDisplay as unknown as {
          getBoundingSphere?: (e: Cesium.Entity, b: boolean, r: Cesium.BoundingSphere) => number;
        }
      ).getBoundingSphere?.(entity, true, new Cesium.BoundingSphere());
      // BoundingSphereState.DONE === 0 once the model's geometry is loaded.
      if (primitive === 0 && entity.billboard) {
        entity.billboard.show = new Cesium.ConstantProperty(false);
        settled = true;
        stopWatching();
      }
    });

    return () => {
      stopWatching();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, layers.vessel, vessel.type]);

  useEffect(() => {
    const unsub = useSimulationStore.subscribe((s) => {
      shipStateRef.current = { lat: s.shipPosition.lat, lon: s.shipPosition.lon, heading: s.shipHeadingDeg };
    });
    return unsub;
  }, []);

  // --- camera modes ---------------------------------------------------
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || viewer.isDestroyed()) return;

    if (cameraMode === 'free') {
      viewer.trackedEntity = undefined;
      return;
    }
    if (cameraMode === 'global') {
      viewer.trackedEntity = undefined;
      return;
    }
    if (!vesselEntityRef.current) return;

    if (cameraMode === 'follow') {
      viewer.trackedEntity = vesselEntityRef.current;
    } else if (cameraMode === 'chase') {
      viewer.trackedEntity = vesselEntityRef.current;
    } else if (cameraMode === 'tactical') {
      viewer.trackedEntity = vesselEntityRef.current;
    }
  }, [cameraMode, status]);

  // --- focus requests (event log clicks) -------------------------------
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || viewer.isDestroyed() || !focusRequest) return;
    viewer.trackedEntity = undefined;
    viewer.camera.flyTo({
      destination: toCartesian(focusRequest.location.lat, focusRequest.location.lon, 1_200_000),
      duration: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 1.2,
    });
  }, [focusRequest]);

  return <div ref={containerRef} className="h-full w-full" />;
}
