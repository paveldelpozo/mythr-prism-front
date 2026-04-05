import { mount } from '@vue/test-utils';
import { afterEach, describe, expect, it, vi } from 'vitest';
import RemotePairingModal from './RemotePairingModal.vue';

const room = {
  roomId: 'room-1',
  joinUrl: 'https://mythr.app/remote?roomId=room-1&pairingCode=ABCD-1234-EFGH',
  pairCode: 'ABCD-1234-EFGH',
  expiresAtMs: Date.now() + 60_000
};

const mountModal = () =>
  mount(RemotePairingModal, {
    props: {
      open: true,
      room,
      pendingApprovals: [],
      isConnecting: false,
      expiresInMs: 30_000,
      error: null
    },
    global: {
      stubs: {
        teleport: true
      }
    }
  });

const originalClipboardDescriptor = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
const originalExecCommand = document.execCommand;

const setClipboard = (writeText: (text: string) => Promise<void>) => {
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: { writeText }
  });
};

afterEach(() => {
  if (originalClipboardDescriptor) {
    Object.defineProperty(navigator, 'clipboard', originalClipboardDescriptor);
  } else {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: undefined
    });
  }
  document.execCommand = originalExecCommand;
  vi.restoreAllMocks();
});

describe('components/RemotePairingModal', () => {
  it('copia el codigo de cliente usando navigator.clipboard', async () => {
    const writeText = vi.fn(async () => undefined);
    setClipboard(writeText);

    const wrapper = mountModal();

    await wrapper.get('[data-testid="remote-pairing-copy-code"]').trigger('click');

    expect(writeText).toHaveBeenCalledWith('ABCD-1234-EFGH');
    expect(wrapper.get('[data-testid="remote-pairing-copy-feedback"]').text()).toContain('Codigo copiado');
  });

  it('usa fallback con execCommand si clipboard no esta disponible', async () => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: undefined
    });
    const execCommandSpy = vi.fn(() => true);
    document.execCommand = execCommandSpy;

    const wrapper = mountModal();

    await wrapper.get('[data-testid="remote-pairing-copy-code"]').trigger('click');

    expect(execCommandSpy).toHaveBeenCalledWith('copy');
    expect(wrapper.get('[data-testid="remote-pairing-copy-feedback"]').text()).toContain('Codigo copiado');
  });

  it('muestra error si clipboard y fallback fallan', async () => {
    const writeText = vi.fn(async () => {
      throw new Error('clipboard-denied');
    });
    setClipboard(writeText);
    const execCommandSpy = vi.fn(() => false);
    document.execCommand = execCommandSpy;

    const wrapper = mountModal();

    await wrapper.get('[data-testid="remote-pairing-copy-code"]').trigger('click');

    expect(writeText).toHaveBeenCalledWith('ABCD-1234-EFGH');
    expect(execCommandSpy).toHaveBeenCalledWith('copy');
    expect(wrapper.get('[data-testid="remote-pairing-copy-feedback"]').text()).toContain('No se pudo copiar');
  });
});
