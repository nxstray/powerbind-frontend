import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'

import ChatInputBar from '@/components/ChatInputBar.vue'

describe('ChatInputBar', () => {
  it('me-render textarea dengan nilai input dan placeholder', () => {
    const wrapper = mount(ChatInputBar, {
      props: {
        input: 'Halo bot',
      },
    })

    const textarea = wrapper.find('textarea')
    expect(textarea.element.value).toBe('Halo bot')
    expect(textarea.attributes('placeholder')).toBe('Tulis pesan')
  })

  it('meng-emit update:input saat pengguna mengetik', async () => {
    const wrapper = mount(ChatInputBar, {
      props: {
        input: '',
      },
    })

    const textarea = wrapper.find('textarea')
    await textarea.setValue('Pertanyaan baru')

    expect(wrapper.emitted('update:input')).toBeTruthy()
    expect(wrapper.emitted('update:input')[0]).toEqual(['Pertanyaan baru'])
  })

  it('tombol send disabled saat input kosong dan tidak ada pending file', () => {
    const wrapper = mount(ChatInputBar, {
      props: {
        input: '',
        pendingFile: null,
      },
    })

    const sendBtn = wrapper.find('[data-testid="send-button"]')
    expect(sendBtn.attributes('disabled')).toBeDefined()
  })

  it('tombol send aktif jika ada text atau pending file', async () => {
    const wrapper = mount(ChatInputBar, {
      props: {
        input: 'ada teks',
        pendingFile: null,
      },
    })

    const sendBtn = wrapper.find('[data-testid="send-button"]')
    expect(sendBtn.attributes('disabled')).toBeUndefined()

    await sendBtn.trigger('click')
    expect(wrapper.emitted('send')).toHaveLength(1)
  })

  it('menekan Enter di textarea meng-emit send', async () => {
    const wrapper = mount(ChatInputBar, {
      props: {
        input: 'kirim ini',
      },
    })

    const textarea = wrapper.find('textarea')
    await textarea.trigger('keydown.enter')

    expect(wrapper.emitted('send')).toHaveLength(1)
  })

  it('klik tombol mic meng-emit toggle-voice', async () => {
    const wrapper = mount(ChatInputBar, {
      props: {
        input: '',
        isRecording: false,
      },
    })

    const micBtn = wrapper.findAll('button')[1] // 0: attach, 1: mic, 2: send
    await micBtn.trigger('click')

    expect(wrapper.emitted('toggle-voice')).toHaveLength(1)
  })

  it('menampilkan preview file lampiran dan meng-emit clear-file saat dihapus', async () => {
    const mockFile = new File(['content'], 'laporan.pdf', { type: 'application/pdf' })
    const wrapper = mount(ChatInputBar, {
      props: {
        input: '',
        pendingFile: mockFile,
        pendingFilePreview: null,
      },
    })

    expect(wrapper.text()).toContain('laporan.pdf')

    const closeBtn = wrapper.find('button.hover\\:text-red-500')
    await closeBtn.trigger('click')

    expect(wrapper.emitted('clear-file')).toHaveLength(1)
  })

  it('menangani pemilihan file dari input file', async () => {
    const wrapper = mount(ChatInputBar, {
      props: {
        input: '',
      },
    })

    const fileInput = wrapper.find('input[type="file"]')
    const file = new File(['test'], 'doc.pdf', { type: 'application/pdf' })
    Object.defineProperty(fileInput.element, 'files', {
      value: [file],
      writable: true,
    })

    await fileInput.trigger('change')

    expect(wrapper.emitted('file-select')).toHaveLength(1)
    expect(wrapper.emitted('file-select')[0]).toEqual([file])
  })

  it('mengosongkan tinggi textarea saat props.input direset', async () => {
    const wrapper = mount(ChatInputBar, {
      props: {
        input: 'Pesan panjang',
      },
    })

    await wrapper.setProps({ input: '' })
    expect(wrapper.vm.input).toBe('')
  })
})
