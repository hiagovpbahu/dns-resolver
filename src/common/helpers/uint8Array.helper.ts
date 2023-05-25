export function concatenateUint8Arrays(...arrays: Uint8Array[]): Uint8Array {
  const totalLength = arrays.reduce(
    (length: number, array: Uint8Array) => length + array.length,
    0,
  )
  const result = new Uint8Array(totalLength)

  let offset = 0
  arrays.forEach((array: Uint8Array) => {
    result.set(array, offset)
    offset += array.length
  })

  return result
}
