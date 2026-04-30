import * as SecureStore from 'expo-secure-store';
import * as WebBrowser from 'expo-web-browser';
import * as base64 from 'base64-js';
import { useDeveloperStore } from '../store/useDeveloperStore';

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

  async getValidToken(GoogleSignin: any): Promise<string | null> {
    const logger = useDeveloperStore.getState();
    
    // 1. まずは保存されているトークンを確認
    let token = await this.getStoredToken();
    
    // 2. ネイティブ環境ならサイレントサインインを試行してトークンを更新
    if (GoogleSignin) {
      try {
        logger.addLog('debug', 'Attempting silent sign-in...');
        const user = await GoogleSignin.signInSilently();
        const tokens = await GoogleSignin.getTokens();
        if (tokens.accessToken) {
          logger.addLog('debug', 'Silent sign-in successful, token refreshed');
          await this.saveToken(tokens.accessToken);
          return tokens.accessToken;
        }
      } catch (error: any) {
        logger.addLog('debug', `Silent sign-in failed or no user: ${error.message}`);
        // サイレントサインインに失敗しても、保存されているトークンがあればそれを使う（後で401になる可能性はある）
      }
    }
    
    return token;
  },

  async listMessages(token: string, query: string) {
    const logger = useDeveloperStore.getState();
    logger.addLog('debug', `Gmail API Request: listMessages (query: ${query})`);
    const response = await fetch(
      `https://www.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(query)}`,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );

    if (!response.ok) {
      logger.addLog('error', `Gmail API Error (listMessages): ${response.status} ${response.statusText}`);
      if (response.status === 401) {
        await this.removeToken();
        throw new Error('Unauthorized');
      }
      throw new Error('Failed to fetch messages');
    }

    const data = await response.json();
    logger.addLog('debug', `Gmail API Response: Found ${data.messages?.length || 0} messages`);
    return data.messages || [];
  },

  async getMessage(token: string, messageId: string): Promise<GmailMessage> {
    const logger = useDeveloperStore.getState();
    logger.addLog('debug', `Gmail API Request: getMessage (id: ${messageId})`);
    const response = await fetch(
      `https://www.googleapis.com/gmail/v1/users/me/messages/${messageId}`,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );

    if (!response.ok) {
      logger.addLog('error', `Gmail API Error (getMessage): ${response.status} ${response.statusText}`);
      throw new Error('Failed to fetch message details');
    }

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
