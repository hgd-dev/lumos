import { cholesky } from "../bayesian/linalg.js";

const EPSILON = 1e-12;

export function submatrix(matrix, indices) {
  return indices.map((rowIndex) => Float64Array.from(
    indices.map((columnIndex) => matrix[rowIndex][columnIndex])
  ));
}

export function addDiagonal(matrix, diagonalValues) {
  return matrix.map((row, rowIndex) => Float64Array.from(
    row,
    (value, columnIndex) => value + (rowIndex === columnIndex ? diagonalValues[rowIndex] : 0)
  ));
}

export function logDeterminantPositiveDefinite(matrix) {
  if (matrix.length === 0) return 0;
  const lower = cholesky(matrix);
  let value = 0;
  for (let index = 0; index < lower.length; index += 1) {
    value += 2 * Math.log(Math.max(EPSILON, lower[index][index]));
  }
  return value;
}

export function matrixSubtract(left, right) {
  return left.map((row, rowIndex) => Float64Array.from(
    row,
    (value, columnIndex) => value - right[rowIndex][columnIndex]
  ));
}

export function symmetricProductWithInverse(crossCovariance, lower) {
  const rowCount = crossCovariance.length;
  const columnCount = lower.length;
  const solved = crossCovariance.map((row) => {
    const forward = new Float64Array(columnCount);
    const result = new Float64Array(columnCount);

    for (let rowIndex = 0; rowIndex < columnCount; rowIndex += 1) {
      let value = row[rowIndex];
      for (let columnIndex = 0; columnIndex < rowIndex; columnIndex += 1) {
        value -= lower[rowIndex][columnIndex] * forward[columnIndex];
      }
      forward[rowIndex] = value / lower[rowIndex][rowIndex];
    }

    for (let rowIndex = columnCount - 1; rowIndex >= 0; rowIndex -= 1) {
      let value = forward[rowIndex];
      for (let columnIndex = rowIndex + 1; columnIndex < columnCount; columnIndex += 1) {
        value -= lower[columnIndex][rowIndex] * result[columnIndex];
      }
      result[rowIndex] = value / lower[rowIndex][rowIndex];
    }

    return result;
  });

  return Array.from({ length: rowCount }, (_, leftIndex) => {
    const row = new Float64Array(rowCount);
    for (let rightIndex = 0; rightIndex < rowCount; rightIndex += 1) {
      let value = 0;
      for (let columnIndex = 0; columnIndex < columnCount; columnIndex += 1) {
        value += crossCovariance[leftIndex][columnIndex] * solved[rightIndex][columnIndex];
      }
      row[rightIndex] = value;
    }
    return row;
  });
}
