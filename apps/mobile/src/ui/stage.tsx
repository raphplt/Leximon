import {
  advance,
  type BurstSettings,
  drawIn,
  easings,
  effects,
  emit,
  intensity,
  lettering,
  opacityOf,
  type Particle,
  particleCap,
  type RevealEffect,
  rarityLights,
  revealEffects,
  sizeOf,
} from "@leximon/tokens";
import {
  BlendMode,
  Canvas,
  createPicture,
  Picture,
  Skia,
  type SkPath,
  type SkShader,
  StrokeCap,
  TileMode,
} from "@shopify/react-native-skia";
import { createContext, type ReactNode, useContext, useEffect, useMemo, useRef } from "react";
import { StyleSheet, View, type ViewInstance } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useDerivedValue,
  useFrameCallback,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withTiming,
} from "react-native-reanimated";

/**
 * What a screen may set off over everything else: particles, a flash, a ring, a shake. Points
 * are in window coordinates, as `measureInWindow` gives them.
 */
export interface Stage {
  readonly burst: (x: number, y: number, settings: BurstSettings) => void;
  /** Light converging on a point, for `ms`. */
  readonly drawIn: (x: number, y: number, colors: readonly string[], ms: number) => void;
  /** Leaves falling from the top of the screen. */
  readonly rain: (count: number) => void;
  readonly flash: (opacity: number, ms: number) => void;
  /** A ring of light growing from a point, to `scale` times its size. */
  readonly ring: (x: number, y: number, color: string, scale: number) => void;
  /** Shakes everything inside the stage. */
  readonly shake: (strength: number, ms: number) => void;
  /** Everything a card's face does as it turns, centered on the card. */
  readonly reveal: (x: number, y: number, effect: RevealEffect, color: string) => void;
}

const StageContext = createContext<Stage | null>(null);

export function useStage(): Stage {
  const stage = useContext(StageContext);
  if (stage === null) throw new Error("useStage outside of a ParticleStage");
  return stage;
}

/** The stage of the screen, or null where none is drawn (the current look). */
export function useOptionalStage(): Stage | null {
  return useContext(StageContext);
}

const RING_SIZE = 80;
const SETTLE = Easing.bezier(...easings.settle);

function starPath(): SkPath {
  const path = Skia.PathBuilder.Make();
  for (let point = 0; point < 8; point++) {
    const radius = point % 2 === 1 ? 0.28 : 1;
    const angle = (point / 8) * Math.PI * 2;
    const x = Math.cos(angle) * radius;
    const y = Math.sin(angle) * radius;
    if (point === 0) path.moveTo(x, y);
    else path.lineTo(x, y);
  }
  return path.close().detach();
}

function leafPath(): SkPath {
  return Skia.PathBuilder.Make()
    .moveTo(-1, 0)
    .quadTo(0, -0.7, 1, 0)
    .quadTo(0, 0.7, -1, 0)
    .close()
    .detach();
}

/** Every color a glow may take: its gradient is built once, never during a frame. */
function glowColors(): readonly string[] {
  const bursts: readonly BurstSettings[] = [
    effects.dust.burst,
    effects.charge.burst,
    ...effects.burst,
    effects.land,
    effects.reward,
    ...Object.values(revealEffects).flatMap((effect) => effect.bursts),
  ];
  const colors = bursts
    .filter((burst) => burst.kinds.includes("glow"))
    .flatMap((burst) => burst.colors);
  return [...new Set([...colors, ...Object.values(rarityLights).flat()])];
}

/** A soft light of radius 1 around the origin, full at its heart and gone at its edge. */
function glowShader(color: string): SkShader {
  const full = Skia.Color(color);
  const clear = Float32Array.of(full[0] ?? 1, full[1] ?? 1, full[2] ?? 1, 0);
  return Skia.Shader.MakeRadialGradient(
    { x: 0, y: 0 },
    1,
    [full, full, clear],
    [0, 0.25, 1],
    TileMode.Clamp,
  );
}

/**
 * The layer over the stage where the light of « La Bibliothèque » is drawn by Skia. Particles
 * move and are drawn on the UI thread; the JavaScript thread only asks for bursts. Nothing is
 * drawn for a player who asks for reduced motion.
 */
export function ParticleStage({
  dust = false,
  children,
}: {
  /** Motes drifting in the lamplight, while this stage is shown. */
  readonly dust?: boolean;
  readonly children: ReactNode;
}) {
  const reduced = useReducedMotion();
  const particles = useSharedValue<Particle[]>([]);
  const size = useSharedValue({ width: 0, height: 0 });
  const dusty = useSharedValue(dust);
  const clock = useSharedValue(0);
  const origin = useRef({ x: 0, y: 0 });
  const frame = useRef<ViewInstance>(null);
  const flashOpacity = useSharedValue(0);
  const ringPlace = useSharedValue<{ x: number; y: number; color: string }>({
    x: 0,
    y: 0,
    color: lettering.fill,
  });
  const ringScale = useSharedValue(0);
  const ringOpacity = useSharedValue(0);
  const shakeX = useSharedValue(0);
  const shakeY = useSharedValue(0);
  const shapes = useMemo(() => ({ star: starPath(), leaf: leafPath() }), []);
  const glows = useMemo(
    () => Object.fromEntries(glowColors().map((color) => [color, glowShader(color)])),
    [],
  );

  useEffect(() => {
    dusty.value = dust && !reduced;
  }, [dust, reduced, dusty]);

  useFrameCallback((info) => {
    const seconds = Math.min((info.timeSincePreviousFrame ?? 16) / 1000, 0.05);
    const list = particles.value;
    if (dusty.value && Math.random() < seconds * effects.dust.perSecond) {
      const { width, height } = size.value;
      emit(
        list,
        width * (0.2 + Math.random() * 0.6),
        height * (0.2 + Math.random() * 0.5),
        effects.dust.burst,
        particleCap.mobile,
        1,
      );
    }
    if (list.length === 0 && clock.value === -1) return;
    advance(list, seconds);
    // Once the last particle is gone, one more frame clears the canvas, then nothing redraws.
    clock.value = list.length === 0 ? -1 : info.timestamp;
  });

  const picture = useDerivedValue(() => {
    clock.value;
    const paint = Skia.Paint();
    paint.setAntiAlias(true);
    const glowPaint = Skia.Paint();
    glowPaint.setAntiAlias(true);
    glowPaint.setBlendMode(BlendMode.Plus);
    return createPicture((canvas) => {
      for (const particle of particles.value) {
        const opacity = Math.max(0, opacityOf(particle));
        const radius = sizeOf(particle);
        const shader = particle.kind === "glow" ? glows[particle.color] : undefined;
        if (shader !== undefined) {
          glowPaint.setShader(shader);
          glowPaint.setAlphaf(opacity);
          canvas.save();
          canvas.translate(particle.x, particle.y);
          canvas.scale(radius * 3, radius * 3);
          canvas.drawCircle(0, 0, 1, glowPaint);
          canvas.restore();
          continue;
        }
        paint.setColor(Skia.Color(particle.color));
        const alpha = paint.getAlphaf();
        paint.setBlendMode(particle.kind === "leaf" ? BlendMode.SrcOver : BlendMode.Plus);
        if (particle.kind === "glow") {
          // A color with no gradient built: three discs, rather than a blur in every frame.
          for (const [scale, weight] of [
            [3, 0.18],
            [1.6, 0.35],
            [0.8, 0.8],
          ] as const) {
            paint.setAlphaf(alpha * opacity * weight);
            canvas.drawCircle(particle.x, particle.y, radius * scale, paint);
          }
        } else if (particle.kind === "spark") {
          paint.setAlphaf(alpha * opacity);
          paint.setStrokeWidth(radius);
          paint.setStrokeCap(StrokeCap.Round);
          canvas.drawLine(
            particle.x,
            particle.y,
            particle.x - particle.vx * 0.045,
            particle.y - particle.vy * 0.045,
            paint,
          );
        } else {
          paint.setAlphaf(alpha * opacity);
          canvas.save();
          canvas.translate(particle.x, particle.y);
          if (particle.kind === "star") {
            canvas.rotate((particle.turn * 0.3 * 180) / Math.PI, 0, 0);
            const twinkle = radius * (0.75 + 0.25 * Math.sin(particle.flip));
            canvas.scale(twinkle, twinkle);
            canvas.drawPath(shapes.star, paint);
          } else {
            canvas.rotate((particle.turn * 180) / Math.PI, 0, 0);
            canvas.scale(radius * Math.cos(particle.flip), radius);
            canvas.drawPath(shapes.leaf, paint);
          }
          canvas.restore();
        }
      }
    });
  });

  const shaken = useAnimatedStyle(() => ({
    transform: [{ translateX: shakeX.value }, { translateY: shakeY.value }],
  }));
  const flashStyle = useAnimatedStyle(() => ({ opacity: flashOpacity.value }));
  const ringStyle = useAnimatedStyle(() => ({
    opacity: ringOpacity.value,
    borderColor: ringPlace.value.color,
    boxShadow: `0 0 24px ${ringPlace.value.color}`,
    transform: [
      { translateX: ringPlace.value.x - RING_SIZE / 2 },
      { translateY: ringPlace.value.y - RING_SIZE / 2 },
      { scale: ringScale.value },
    ],
  }));

  const stage = useMemo<Stage>(() => {
    const local = (x: number, y: number) => ({ x: x - origin.current.x, y: y - origin.current.y });
    const burst = (x: number, y: number, settings: BurstSettings) => {
      if (reduced) return;
      const point = local(x, y);
      particles.modify((list) => {
        "worklet";
        emit(list, point.x, point.y, settings, particleCap.mobile);
        return list;
      });
      clock.value = 0;
    };
    const rain = (count: number) => {
      const half = size.value.width / 2;
      burst(origin.current.x + half, origin.current.y - 20, {
        ...effects.rain,
        count,
        spread: half,
      });
    };
    const flash = (opacity: number, ms: number) => {
      if (reduced) return;
      flashOpacity.value = withSequence(
        withTiming(opacity * intensity, { duration: 0 }),
        withTiming(0, { duration: ms, easing: Easing.out(Easing.quad) }),
      );
    };
    const shake = (strength: number, ms: number) => {
      if (reduced) return;
      const step = ms / 11;
      const swings = () =>
        withSequence(
          ...Array.from({ length: 10 }, (_, index) => {
            const reach = strength * intensity * (1 - index / 10);
            return withTiming((Math.random() * 2 - 1) * reach, { duration: step });
          }),
          withTiming(0, { duration: step }),
        );
      shakeX.value = swings();
      shakeY.value = swings();
    };
    const ringAt = (x: number, y: number, color: string, scale: number) => {
      if (reduced) return;
      ringPlace.value = { ...local(x, y), color };
      ringScale.value = withSequence(
        withTiming(0.2, { duration: 0 }),
        withTiming(scale, { duration: 650, easing: SETTLE }),
      );
      ringOpacity.value = withSequence(
        withTiming(1, { duration: 0 }),
        withTiming(0, { duration: 650, easing: SETTLE }),
      );
    };
    return {
      burst,
      rain,
      flash,
      shake,
      ring: ringAt,
      drawIn: (x, y, colors, ms) => {
        if (reduced) return;
        const point = local(x, y);
        const timer = setInterval(() => {
          particles.modify((list) => {
            "worklet";
            drawIn(list, point.x, point.y, colors, 3, particleCap.mobile);
            return list;
          });
          clock.value = 0;
        }, 60);
        setTimeout(() => clearInterval(timer), ms);
      },
      reveal: (x, y, effect, color) => {
        for (const settings of effect.bursts) burst(x, y, settings);
        if (effect.rain > 0) rain(effect.rain);
        if (effect.ring > 0) ringAt(x, y, color, effect.ring);
        if (effect.flash !== null) flash(effect.flash.opacity, effect.flash.ms);
        if (effect.shake !== null) shake(effect.shake.strength, effect.shake.ms);
      },
    };
  }, [
    reduced,
    particles,
    clock,
    size,
    flashOpacity,
    shakeX,
    shakeY,
    ringPlace,
    ringScale,
    ringOpacity,
  ]);

  return (
    <StageContext value={stage}>
      <View
        ref={frame}
        style={styles.stage}
        onLayout={({ nativeEvent: { layout } }) => {
          size.value = { width: layout.width, height: layout.height };
          frame.current?.measureInWindow((x, y) => {
            origin.current = { x, y };
          });
        }}
      >
        <Animated.View style={[styles.stage, shaken]}>{children}</Animated.View>
        <Animated.View pointerEvents="none" style={[styles.flash, flashStyle]} />
        <Animated.View pointerEvents="none" style={[styles.ring, ringStyle]} />
        <Canvas style={styles.canvas} pointerEvents="none">
          <Picture picture={picture} />
        </Canvas>
      </View>
    </StageContext>
  );
}

const styles = StyleSheet.create({
  stage: { flex: 1 },
  canvas: { ...StyleSheet.absoluteFill },
  flash: { ...StyleSheet.absoluteFill, backgroundColor: lettering.fill, opacity: 0 },
  ring: {
    position: "absolute",
    left: 0,
    top: 0,
    width: RING_SIZE,
    height: RING_SIZE,
    borderWidth: 5,
    borderRadius: RING_SIZE / 2,
    opacity: 0,
  },
});
