import React from 'react';
import {
  Pressable,
  Text,
  StyleSheet,
  ActivityIndicator,
  View,
  Platform,
  StyleProp,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface GoogleSignInButtonProps {
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  title?: string;
}

export const GoogleSignInButton: React.FC<GoogleSignInButtonProps> = ({
  onPress,
  loading = false,
  disabled = false,
  style,
  textStyle,
  title = 'Đăng nhập bằng Google',
}) => {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.button,
        disabled || loading ? styles.disabled : null,
        pressed ? styles.pressed : null,
        style,
      ]}
      onPress={onPress}
      disabled={disabled || loading}>
      {loading ? (
        <ActivityIndicator color="#4285F4" size="small" style={styles.spinner} />
      ) : (
        <View style={styles.iconContainer}>
          <Ionicons name="logo-google" size={20} color="#4285F4" />
        </View>
      )}
      <Text style={[styles.text, textStyle]}>{loading ? 'Đang xử lý...' : title}</Text>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#dadce0',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.12,
    shadowRadius: 2,
  },
  pressed: {
    backgroundColor: '#f8f9fa',
    borderColor: '#c6c6c6',
  },
  disabled: {
    opacity: 0.65,
  },
  spinner: {
    marginRight: 10,
  },
  iconContainer: {
    marginRight: 12,
  },
  text: {
    fontSize: 15,
    fontWeight: '600',
    color: '#3c4043',
    fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif-medium',
  },
});
