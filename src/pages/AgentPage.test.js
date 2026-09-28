import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { nextTick } from 'vue'

import AgentPage from '@/pages/AgentPage.vue'
import agentService from '@/services/agentService'
import { useAuthStore } from '@/stores/authStore'

let mockStompClient

vi.mock('sockjs-client', () => {
  return {
    default: class MockSockJS {},
  }
})


vi.mock('@stomp/stompjs', () => {
  return {
    Client: class MockClient {
      constructor(opts) {
        this.opts = opts
        mockStompClient = this
      }
      activate() {
        if (this.opts?.onConnect) this.opts.onConnect()
      }
      deactivate() {}
      subscribe(topic, cb) {
        this.subscribedTopic = topic
        this.topicCallback = cb
        return { unsubscribe: vi.fn() }
      }
    },
  }
})


const pushMock = vi.fn()
const replaceMock = vi.fn()
let routeState = {
  name: 'agent',
  params: {},
}

vi.mock('vue-router', () => ({
  useRouter: () => ({
    push: pushMock,
    replace: replaceMock,
  }),
  useRoute: () => routeState,
}))

vi.mock('@/services/agentService', () => ({
  default: {
    getConversations: vi.fn(),
    getConversationMessages: vi.fn(),
    streamChat: vi.fn(),
    streamVision: vi.fn(),
    streamDocument: vi.fn(),
    renameConversation: vi.fn(),
    deleteConversation: vi.fn(),
    transcribe: vi.fn(),
  },
}))

let wrapper
function mountPage() {
  wrapper = mount(AgentPage, {
    attachTo: document.body,
    global: {
      mocks: {
        $router: { push: pushMock, replace: replaceMock },
        $route: routeState,
      },
      stubs: {
        MarkdownRenderer: {
          props: ['content'],
          template: '<div class="stub-markdown">{{ content }}</div>',
        },
      },
    },
  })
  return wrapper
}


const fetchMock = vi.fn()

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
  routeState = { name: 'agent', params: {} }
  setActivePinia(createPinia())

  // Mock Element.prototype.scrollTo and getBoundingClientRect for JSDOM
  Element.prototype.scrollTo = vi.fn()
  Element.prototype.getBoundingClientRect = vi.fn().mockReturnValue({
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    width: 100,
    height: 100,
  })

  const auth = useAuthStore()
  auth.user = { id: 1, username: 'admin', displayName: 'Administrator', role: 'ADMIN' }
  vi.spyOn(auth, 'fetchProfile').mockResolvedValue(auth.user)
  vi.spyOn(auth, 'logout').mockResolvedValue()

  fetchMock.mockResolvedValue({
    json: () => Promise.resolve({ current: { weather_code: 0, is_day: 1 } }),
  })
  vi.stubGlobal('fetch', fetchMock)

  agentService.getConversations.mockResolvedValue([
    { id: 'conv-1', title: 'Percakapan 1' },
    { id: 'conv-2', title: 'Percakapan 2' },
  ])
  agentService.getConversationMessages.mockResolvedValue([
    { id: 101, role: 'user', content: 'Halo Gemono', createdAt: '2026-09-27T10:00:00Z' },
    { id: 102, role: 'assistant', content: 'Halo! Ada yang bisa dibantu?', createdAt: '2026-09-27T10:00:05Z' },
  ])
})

afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  document.body.innerHTML = ''
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  vi.useRealTimers()
})

describe('AgentPage', () => {
  it('mounts and loads conversation list on load with typewriter greeting', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] })
    mountPage()
    await flushPromises()

    expect(agentService.getConversations).toHaveBeenCalled()

    vi.advanceTimersByTime(55 * 25)
    await nextTick()
    expect(wrapper.find('h2').text()).toContain('Halo, Administrator')
  })

  it('shows the red load-error text when the conversation list request fails', async () => {
    agentService.getConversations.mockRejectedValue(new Error('backend down'))
    mountPage()
    await flushPromises()

    const alert = wrapper.find('p.text-red-400')
    expect(alert.exists()).toBe(true)
    expect(alert.text()).toContain('Gagal mengambil riwayat percakapan dari /api/agent/conversations')
  })

  it('loads conversation messages when route param id is present', async () => {
    routeState = { name: 'agent', params: { id: 'conv-1' } }
    mountPage()
    await flushPromises()

    expect(agentService.getConversationMessages).toHaveBeenCalledWith('conv-1')
    expect(wrapper.text()).toContain('Halo Gemono')
    expect(wrapper.text()).toContain('Halo! Ada yang bisa dibantu?')
  })

  it('toggles sidebar and history dropdown', async () => {
    mountPage()
    await flushPromises()

    const historyBtn = wrapper.find('.history-trigger')
    await historyBtn.trigger('click')
    expect(wrapper.find('.conv-item').exists()).toBe(true)

    await historyBtn.trigger('click')
    expect(wrapper.find('.conv-item').exists()).toBe(false)
  })

  it('sends user message and streams assistant response', async () => {
    agentService.streamChat.mockImplementation((text, onChunk, onDone) => {
      onChunk('Jawaban ')
      onChunk('AI')
      onDone()
    })

    mountPage()
    await flushPromises()

    const chatBar = wrapper.findComponent({ name: 'ChatInputBar' })
    await chatBar.vm.$emit('update:input', 'Pertanyaan baru')
    await chatBar.vm.$emit('send')
    await flushPromises()

    expect(agentService.streamChat).toHaveBeenCalled()
    expect(wrapper.text()).toContain('Pertanyaan baru')
    expect(wrapper.text()).toContain('Jawaban AI')
  })

  it('handles stream error gracefully with friendly message', async () => {
    agentService.streamChat.mockImplementation((text, onChunk, onDone, onError) => {
      onError(new Error('Network error'))
    })

    mountPage()
    await flushPromises()

    const chatBar = wrapper.findComponent({ name: 'ChatInputBar' })
    await chatBar.vm.$emit('update:input', 'Pertanyaan error')
    await chatBar.vm.$emit('send')
    await flushPromises()

    expect(wrapper.text()).toContain('Maaf, terjadi kesalahan saat menghubungi AI. Coba lagi.')
  })

  it('receives anomaly stomp notification and shows toast', async () => {
    mountPage()
    await flushPromises()

    expect(mockStompClient.subscribedTopic).toBe('/topic/anomaly')

    // Simulate anomaly payload arriving
    mockStompClient.topicCallback({
      body: JSON.stringify({ message: 'Terdeteksi pemborosan listrik di Ruang Server' }),
    })
    await wrapper.vm.$nextTick()
    await flushPromises()

    expect(document.body.textContent).toContain('Terdeteksi pemborosan listrik di Ruang Server')
  })


  it('opens confirmation modal and deletes conversation', async () => {
    agentService.deleteConversation.mockResolvedValue()
    mountPage()
    await flushPromises()

    await wrapper.find('.history-trigger').trigger('click')
    const trashBtn = wrapper.findAll('.conv-item button')[0]
    await trashBtn.trigger('click')
    await wrapper.vm.$nextTick()

    expect(document.body.textContent).toContain('Hapus Percakapan')

    const confirmDialog = wrapper.findAllComponents({ name: 'ConfirmDialog' })
      .find((c) => c.props('title') === 'Hapus Percakapan')
    await confirmDialog.vm.$emit('confirm')
    await flushPromises()

    expect(agentService.deleteConversation).toHaveBeenCalledWith('conv-1')
  })

  it('allows renaming active conversation', async () => {
    routeState = { name: 'agent', params: { id: 'conv-1' } }
    agentService.renameConversation.mockResolvedValue()

    mountPage()
    await flushPromises()

    const titleEl = wrapper.find('.truncate.cursor-text')
    await titleEl.trigger('click')
    await wrapper.vm.$nextTick()

    const titleInput = wrapper.find('#conversation-title-input')
    await titleInput.setValue('Judul Baru')
    await titleInput.trigger('blur')
    await flushPromises()

    expect(agentService.renameConversation).toHaveBeenCalledWith('conv-1', 'Judul Baru')
  })
})


