import { Bloom, EffectComposer, Vignette } from '@react-three/postprocessing'

export function SceneEffects({ reduced }: { reduced: boolean }) {
  if (reduced) return null
  return (
    <EffectComposer multisampling={0} enableNormalPass={false}>
      <Bloom intensity={1.25} luminanceThreshold={0.32} luminanceSmoothing={0.72} mipmapBlur />
      <Vignette eskil={false} offset={0.18} darkness={0.72} />
    </EffectComposer>
  )
}

export default SceneEffects
