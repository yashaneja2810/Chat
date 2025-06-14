import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { MessageCircle, Plus, Users } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Button } from '../ui/Button';
import { LoadingSpinner } from '../ui/LoadingSpinner';
import { Chat, ChatMember } from '../../types/chat';
import { useAuth } from '../../contexts/AuthContext';
import { Database } from '../../types/supabase';
import { Avatar } from '../ui/Avatar';

type ChatRow = Database['public']['Tables']['chats']['Row'];
type ChatMemberRow = Database['public']['Tables']['chat_members']['Row'];
type ProfileRow = Database['public']['Tables']['profiles']['Row'];

interface ChatSidebarProps {
  selectedChatId: string | null;
  onSelectChat: (chatId: string) => void;
  onShowFriends: () => void;
  onShowSettings: () => void;
}

export const ChatSidebar: React.FC<ChatSidebarProps> = ({
  selectedChatId,
  onSelectChat,
  onShowFriends,
  onShowSettings
}) => {
  const [chats, setChats] = useState<Chat[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    let mounted = true;
    let messageChannel: any = null;
    let chatChannel: any = null;

  const fetchChats = async () => {
      try {
        setError(null);
        
        // Don't fetch if user is not loaded yet
        if (!user?.id) {
        return;
      }

        // First get all chats the user is a member of
        const { data: chats, error: chatsError } = await supabase
          .from('chats')
        .select(`
            *,
            chat_members!inner (
              user_id,
              role,
              profiles (
                id,
                full_name,
                username,
                avatar_url,
                is_online,
                last_seen
              )
            ),
            messages (
              id,
          content,
          created_at,
              sender_id
            )
        `)
          .order('updated_at', { ascending: false });

        if (chatsError) throw chatsError;
        if (!chats) return;

        // Process chats with last messages
        const processedChats = chats.map(chat => {
          const otherUser = chat.chat_members
            .find((member: ChatMemberRow & { profiles: ProfileRow }) => member.user_id !== user.id)
            ?.profiles;

          const lastMessage = chat.messages[0];

            return {
              id: chat.id,
            name: chat.name,
              type: chat.type,
            created_at: chat.created_at,
            updated_at: chat.updated_at,
            other_user: otherUser,
            last_message: lastMessage,
            unread_count: 0
          } as Chat;
        });

        if (mounted) {
      setChats(processedChats);
        }
      } catch (err) {
        console.error('Error fetching chats:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch chats');
    } finally {
        if (mounted) {
      setLoading(false);
    }
      }
    };

    const setupRealtimeSubscriptions = () => {
      // Subscribe to new messages
      messageChannel = supabase
        .channel('messages')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'messages',
          },
          () => {
            if (mounted) {
              fetchChats();
            }
          }
        )
        .subscribe();

      // Subscribe to chat member changes
      chatChannel = supabase
        .channel('chat_members')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'chat_members',
          },
          () => {
            if (mounted) {
              fetchChats();
            }
          }
        )
        .subscribe();
    };

    fetchChats();
    setupRealtimeSubscriptions();

    return () => {
      mounted = false;
      if (messageChannel) {
        messageChannel.unsubscribe();
      }
      if (chatChannel) {
        chatChannel.unsubscribe();
      }
    };
  }, [user]);

  const filteredChats = chats.filter(chat =>
    (chat.name?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false) ||
    chat.other_user?.full_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-4 text-center">
        <p className="text-red-500 mb-4">{error}</p>
        <Button
          onClick={() => window.location.reload()}
          variant="primary"
          size="sm"
        >
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-800">
      {/* Search Bar */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="relative">
          <input
            type="text"
            placeholder="Search chats..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <svg
            className="absolute left-3 top-2.5 w-5 h-5 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
          </svg>
        </div>
      </div>

      {/* Chat List */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <LoadingSpinner size="md" />
          </div>
        ) : error ? (
          <div className="flex items-center justify-center h-full text-red-500">
            {error}
          </div>
        ) : filteredChats.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-500 dark:text-gray-400 p-4">
            <svg
              className="w-12 h-12 mb-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
              />
            </svg>
            <p className="text-center">No chats found</p>
            <p className="text-sm text-center mt-2">
              Start a new conversation by clicking the friends button
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {filteredChats.map((chat) => (
              <motion.div
                key={chat.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex items-center p-3 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 ${
                  selectedChatId === chat.id ? 'bg-gray-100 dark:bg-gray-700' : ''
                }`}
                onClick={() => onSelectChat(chat.id)}
              >
                <div className="flex-shrink-0 mr-3">
                  <Avatar
                    src={chat.other_user?.avatar_url}
                    name={chat.other_user?.full_name || 'Unknown User'}
                    size="md"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-medium text-gray-900 dark:text-white truncate">
                      {chat.other_user?.full_name || 'Unknown User'}
                    </h3>
                    {chat.last_message && (
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {new Date(chat.last_message.created_at).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center justify-between mt-1">
                    <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
                      {chat.last_message
                        ? chat.last_message.sender_id === user?.id
                          ? `You: ${chat.last_message.content}`
                          : chat.last_message.content
                        : 'No messages yet'}
                    </p>
                    {chat.unread_count > 0 && (
                      <span className="ml-2 px-2 py-1 text-xs font-medium text-white bg-blue-500 rounded-full">
                        {chat.unread_count}
                      </span>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Bottom Navigation */}
      <div className="h-14 border-t border-gray-200 dark:border-gray-700 flex items-center justify-around">
        <button
          onClick={onShowFriends}
          className="flex-1 h-full flex items-center justify-center text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
            />
          </svg>
        </button>
        <button
          onClick={onShowSettings}
          className="flex-1 h-full flex items-center justify-center text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
            />
          </svg>
        </button>
      </div>
    </div>
  );
};