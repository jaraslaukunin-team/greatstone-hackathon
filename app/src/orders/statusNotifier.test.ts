import { notifyStatusChange } from './statusNotifier';

describe('notifyStatusChange', () => {
  it('не уведомляет при первом статусе', () => {
    const showToast = jest.fn();
    notifyStatusChange(null, 'accepted', { showToast });
    expect(showToast).not.toHaveBeenCalled();
  });

  it('не уведомляет если статус не изменился', () => {
    const showToast = jest.fn();
    notifyStatusChange('accepted', 'accepted', { showToast });
    expect(showToast).not.toHaveBeenCalled();
  });

  it('не уведомляет если выключено', () => {
    const showToast = jest.fn();
    notifyStatusChange('accepted', 'moderation', { enabled: false, showToast });
    expect(showToast).not.toHaveBeenCalled();
  });

  it('показывает тост при смене статуса', () => {
    const showToast = jest.fn();
    notifyStatusChange('accepted', 'moderation', { showToast, preferToast: true });
    expect(showToast).toHaveBeenCalledWith('Статус заказа: Проверяем макет');
  });

  it('зовёт scheduleLocal когда не preferToast', () => {
    const showToast = jest.fn();
    const scheduleLocal = jest.fn();
    notifyStatusChange('accepted', 'production', { showToast, scheduleLocal });
    expect(scheduleLocal).toHaveBeenCalledWith('PicPac', 'Статус заказа: В печати');
    expect(showToast).not.toHaveBeenCalled();
  });
});
