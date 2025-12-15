import '@testing-library/jest-dom'

global.fetch = jest.fn()

// Мокаем scrollIntoView для jsdom (не реализован по умолчанию)
Element.prototype.scrollIntoView = jest.fn()

beforeEach(() => {
  fetch.mockClear()
})

