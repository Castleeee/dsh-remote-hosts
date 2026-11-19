export class Lifetime {
  #active = true
  #disposers = []

  get active() { return this.#active }

  defer(dispose) {
    if (!this.#active) throw new Error('插件生命周期已经结束')
    this.#disposers.push(dispose)
    return dispose
  }

  wrap(target, name, intercept) {
    if (!this.#active) throw new Error('插件生命周期已经结束')
    const descriptor = Object.getOwnPropertyDescriptor(target, name)
    const original = target[name]
    if (typeof original !== 'function') throw new Error(`DSH 接口 ${name} 不可用`)
    let handler = intercept
    const wrapped = function (...args) {
      const next = (...values) => original.apply(this, values)
      return handler === undefined ? next(...args) : handler.call(this, next, ...args)
    }
    Object.defineProperty(target, name, { configurable: true, writable: true, value: wrapped })
    this.defer(() => {
      handler = undefined
      if (Object.getOwnPropertyDescriptor(target, name)?.value !== wrapped) return
      if (descriptor === undefined) delete target[name]
      else Object.defineProperty(target, name, descriptor)
    })
    return wrapped
  }

  dispose() {
    if (!this.#active) return
    this.#active = false
    const errors = []
    for (const dispose of this.#disposers.splice(0).reverse()) {
      try { dispose() } catch (error) { errors.push(error) }
    }
    if (errors.length) throw new AggregateError(errors, `插件清理失败：${errors.map(error => error.message).join('；')}`)
  }
}
