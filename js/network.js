// network.js
// Заглушка для будущего мультиплеера. Функции connect/send/receive пока без реализации.

export class Network {
  constructor() {
    this.connected = false;
  }

  // Подключение к серверу (WebSocket/ WebRTC) — в будущем
  async connect(_url) {
    // TODO: реализовать подключение
    this.connected = true;
  }

  // Отправка игровых событий
  send(_event, _payload) {
    if (!this.connected) return;
    // TODO: отправить через сокет
  }

  // Подписка на события сервера
  onReceive(_handler) {
    // TODO: подписки на сообщения сервера
  }
}

