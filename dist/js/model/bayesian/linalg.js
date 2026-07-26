const JITTER = 1e-10;

export function cholesky(matrix) {
  const size = matrix.length;
  const lower = Array.from({ length: size }, () => new Float64Array(size));

  for (let row = 0; row < size; row += 1) {
    for (let column = 0; column <= row; column += 1) {
      let value = matrix[row][column];
      for (let index = 0; index < column; index += 1) {
        value -= lower[row][index] * lower[column][index];
      }

      if (row === column) {
        lower[row][column] = Math.sqrt(Math.max(value, JITTER));
      } else {
        lower[row][column] = value / lower[column][column];
      }
    }
  }

  return lower;
}

export function solveCholesky(lower, vector) {
  const size = lower.length;
  const forward = new Float64Array(size);
  const result = new Float64Array(size);

  for (let row = 0; row < size; row += 1) {
    let value = vector[row];
    for (let column = 0; column < row; column += 1) {
      value -= lower[row][column] * forward[column];
    }
    forward[row] = value / lower[row][row];
  }

  for (let row = size - 1; row >= 0; row -= 1) {
    let value = forward[row];
    for (let column = row + 1; column < size; column += 1) {
      value -= lower[column][row] * result[column];
    }
    result[row] = value / lower[row][row];
  }

  return result;
}

export function quadraticFormSolve(lower, vector) {
  const solution = solveCholesky(lower, vector);
  let value = 0;
  for (let index = 0; index < vector.length; index += 1) {
    value += vector[index] * solution[index];
  }
  return value;
}
