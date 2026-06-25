import { useRouter } from 'expo-router';
import LoginScreen from '../screens/LoginScreen';

export default function LoginPage() {
  const router = useRouter();
  const navigation = {
    replace: (_screen: string) => router.replace('/dashboard' as any),
    navigate: (_screen: string) => router.push('/register' as any),
  };
  return <LoginScreen navigation={navigation} />;
}