import * as SecureStore from 'expo-secure-store';
import * as WebBrowser from 'expo-web-browser';
import * as base64 from 'base64-js';

WebBrowser.maybeCompleteAuthSession();

const TOKEN_KEY = 'gmail_oauth_token';

export interface GmailMessage {
  id: string;
  threadId: string;
  snippet: string;
  from: string;
  subject: string;
  body: string;
  date: string;
}

export const gmailService = {
  async getStoredToken() {
    return await SecureStore.getItemAsync(TOKEN_KEY);
  },

  async saveToken(token: string) {
    await SecureStore.setItemAsync(TOKEN_KEY, token);
  },

  async removeToken() {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
  },

  async listMessages(token: string, query: string) {
    const response = await fetch(
      `https://www.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(query)}`,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );

    if (!response.ok) {
      if (response.status === 401) {
        await this.removeToken();
        throw new Error('Unauthorized');
      }
      throw new Error('Failed to fetch messages');
    }

    const data = await response.json();
    return data.messages || [];
  },

  async getMessage(token: string, messageId: string): Promise<GmailMessage> {
    const response = await fetch(
      `https://www.googleapis.com/gmail/v1/users/me/messages/${messageId}`,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );

    if (!response.ok) throw new Error('Failed to fetch message details');

    const data = await response.json();
    const headers = data.payload.headers;
    const from = headers.find((h: any) => h.name === 'From')?.value || '';
    const subject = headers.find((h: any) => h.name === 'Subject')?.value || '';
    const date = headers.find((h: any) => h.name === 'Date')?.value || '';

    const decodeBase64 = (data: string) => {
      const normalized = data.replace(/-/g, '+').replace(/_/g, '/');
      const bytes = base64.toByteArray(normalized);
      return new TextDecoder().decode(bytes);
    };

    let body = '';
    if (data.payload.parts) {
      const textPart = data.payload.parts.find((p: any) => p.mimeType === 'text/plain');
      if (textPart && textPart.body.data) {
        body = decodeBase64(textPart.body.data);
      }
    } else if (data.payload.body.data) {
      body = decodeBase64(data.payload.body.data);
    }

    return {
      id: data.id,
      threadId: data.threadId,
      snippet: data.snippet,
      from,
      subject,
      body,
      date,
    };
  },
};
