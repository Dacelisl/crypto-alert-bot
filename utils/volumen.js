// Función para calcular perfil de volumen
function calculateVolumeProfile(candles, bins = 20) {
  const prices = candles.map((c) => c.close)
  const minPrice = Math.min(...prices)
  const maxPrice = Math.max(...prices)
  const range = maxPrice - minPrice
  const binSize = range / bins

  const profile = []
  for (let i = 0; i < bins; i++) {
    const binStart = minPrice + i * binSize
    const binEnd = binStart + binSize

    const volumeInBin = candles.filter((c) => c.close >= binStart && c.close < binEnd).reduce((sum, c) => sum + c.volume, 0)

    profile.push({
      price: (binStart + binEnd) / 2,
      volume: volumeInBin,
    })
  }

  // Normalizar densidad (0-1)
  const maxVolume = Math.max(...profile.map((b) => b.volume))
  profile.forEach((bin) => {
    bin.density = bin.volume / maxVolume
  })

  return {
    getSupportZones: () => profile.filter((b) => b.density > 0.7).sort((a, b) => a.price - b.price),
    getResistanceZones: () => profile.filter((b) => b.density > 0.7).sort((a, b) => b.price - a.price),
    findZone: (price) => profile.find((b) => price >= b.price - binSize / 2 && price <= b.price + binSize / 2),
  }
}

module.exports = { calculateVolumeProfile }
